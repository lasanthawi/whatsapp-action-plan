import OpenAI from 'openai';

import {
  generateAgentReply,
  type AgentCapabilitiesContext,
  type BusinessProfileContext,
  type ConversationTurn,
} from '@/lib/chat-agent';
import {
  checkConnection,
  executeTool,
  getOrCreateComposioUserId,
  getToolSchema,
  isWriteLikeTool,
  listConnectedAccounts,
  sanitizeComposioError,
  searchTools,
  startConnectLink,
} from '@/lib/composio';
import type { ComposioSettings } from '@/lib/settings';
import {
  createToolApproval,
  createToolAuthSession,
  fetchRecentToolRuns,
  getPendingApproval,
  getPendingAuthSession,
  logToolRun,
  resolveToolApproval,
  resolveToolAuthSession,
} from '@/lib/tool-store';

const DEFAULT_MODEL = 'gpt-4o-mini';
const MAX_TOOL_RESULT_LENGTH = 2200;
const MAX_TOOL_CALL_LOOPS = 4;

type ToolContext = {
  phone: string;
  contactName: string;
  latestMessage: string;
  recentTurns: ConversationTurn[];
  capabilities?: AgentCapabilitiesContext;
  businessProfile?: BusinessProfileContext;
  composioSettings: ComposioSettings;
};

type ToolAgentResult = {
  replyText: string;
  mode: 'plain' | 'operator_tools';
};

type LocalToolHandler = (args: Record<string, unknown>, context: ToolContext) => Promise<unknown>;

const TOOL_DEFS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'search_composio_tools',
      description: 'Search enabled Composio tools for the operator intent and find the best matching action.',
      parameters: {
        type: 'object',
        properties: {
          intent: { type: 'string' },
          toolkits: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional subset of toolkit slugs such as github, slack, gmail, google_drive, calendar.',
          },
        },
        required: ['intent'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_tool_schema',
      description: 'Get the input schema and description for a Composio tool slug.',
      parameters: {
        type: 'object',
        properties: {
          toolSlug: { type: 'string' },
        },
        required: ['toolSlug'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_connected_accounts',
      description: 'List the active connection status for enabled toolkits for this operator.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'manage_tool_connection',
      description: 'Check or start a Composio connection flow for a toolkit.',
      parameters: {
        type: 'object',
        properties: {
          toolkit: { type: 'string' },
          action: {
            type: 'string',
            enum: ['check', 'connect'],
          },
        },
        required: ['toolkit', 'action'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'execute_composio_tool',
      description:
        'Execute a Composio tool for the operator. For sensitive/write actions, the runtime may require approval before execution.',
      parameters: {
        type: 'object',
        properties: {
          toolSlug: { type: 'string' },
          arguments: { type: 'object', additionalProperties: true },
          actionTitle: { type: 'string' },
        },
        required: ['toolSlug', 'arguments'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'request_approval',
      description: 'Request explicit operator confirmation for a sensitive tool action.',
      parameters: {
        type: 'object',
        properties: {
          toolSlug: { type: 'string' },
          toolkit: { type: 'string' },
          actionTitle: { type: 'string' },
          arguments: { type: 'object', additionalProperties: true },
        },
        required: ['toolSlug', 'toolkit', 'actionTitle', 'arguments'],
        additionalProperties: false,
      },
    },
  },
];

function getOpenAiClient() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  return new OpenAI({ apiKey });
}

function getModel() {
  return process.env.CHAT_AGENT_MODEL?.trim() || DEFAULT_MODEL;
}

function enabledToolkitsFromSettings(settings: ComposioSettings, capabilities?: AgentCapabilitiesContext) {
  const toolkits = new Set(settings.enabledToolkits || []);
  if (capabilities?.github) toolkits.add('github');
  if (capabilities?.drive) toolkits.add('google_drive');
  return Array.from(toolkits);
}

export function isOperatorPhone(phone: string, settings: ComposioSettings) {
  return settings.operatorPhoneAllowlist.includes(phone);
}

function isApprovalMessage(message: string) {
  return /^(confirm|approve|yes confirm|merge confirm)\b/i.test(message.trim());
}

function isLikelyWriteAction(toolSlug: string, settings: ComposioSettings) {
  const slug = toolSlug.toLowerCase();
  return (
    isWriteLikeTool(toolSlug) ||
    settings.approvalRequiredActions.some((action) => slug.includes(action.toLowerCase()))
  );
}

function compactJson(value: unknown) {
  try {
    const text = JSON.stringify(value);
    return text.length > MAX_TOOL_RESULT_LENGTH
      ? `${text.slice(0, MAX_TOOL_RESULT_LENGTH)}…`
      : text;
  } catch {
    return String(value);
  }
}

function summarizeResult(value: unknown) {
  const text = compactJson(value);
  return text.replace(/\s+/g, ' ').trim();
}

function sanitizeOpenAiError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/sk-[A-Za-z0-9_-]+/g, '[redacted-key]').replace(/\s+/g, ' ').trim();
}

async function executeApprovedTool(approvalId: string, context: ToolContext) {
  const approval = await getPendingApproval(context.phone);
  if (!approval || approval.id !== approvalId) {
    return null;
  }

  const enabledToolkits = enabledToolkitsFromSettings(context.composioSettings, context.capabilities);
  const connection = await checkConnection(context.phone, approval.toolkit, enabledToolkits);

  if (!connection.isActive) {
    const started = await startConnectLink({
      phone: context.phone,
      toolkit: approval.toolkit,
      enabledToolkits,
    });

    await createToolAuthSession({
      requesterPhone: context.phone,
      toolkit: approval.toolkit,
      composioUserId: await getOrCreateComposioUserId(context.phone),
      redirectUrl: started.redirectUrl,
      callbackContext: {
        reason: 'approval_resume',
        approvalId: approval.id,
        toolSlug: approval.tool_slug,
      },
    });

    return `I still need ${approval.toolkit} connected before I can finish "${approval.action_title}". Open this link, complete the connection, then send any message here and I’ll continue: ${started.redirectUrl}`;
  }

  const start = Date.now();
  try {
    const result = await executeTool({
      phone: context.phone,
      toolSlug: approval.tool_slug,
      arguments_: approval.arguments_json,
      enabledToolkits,
    });

    await resolveToolApproval(approval.id, 'approved');
    await logToolRun({
      requesterPhone: context.phone,
      toolkit: approval.toolkit,
      toolSlug: approval.tool_slug,
      status: 'success',
      approvalState: 'approved',
      argumentsSummary: summarizeResult(approval.arguments_json),
      resultSummary: summarizeResult(result),
      durationMs: Date.now() - start,
    });

    return `Approved and completed "${approval.action_title}". Result: ${summarizeResult(result)}`;
  } catch (error) {
    await logToolRun({
      requesterPhone: context.phone,
      toolkit: approval.toolkit,
      toolSlug: approval.tool_slug,
      status: 'failed',
      approvalState: 'approved',
      argumentsSummary: summarizeResult(approval.arguments_json),
      resultSummary: sanitizeComposioError(error),
      durationMs: Date.now() - start,
    });

    return `I tried to run "${approval.action_title}" after your confirmation, but it failed: ${sanitizeComposioError(error)}`;
  }
}

async function maybeResumePendingAuth(context: ToolContext) {
  const pending = await getPendingAuthSession(context.phone);
  if (!pending) return null;

  const enabledToolkits = enabledToolkitsFromSettings(context.composioSettings, context.capabilities);
  const connection = await checkConnection(context.phone, pending.toolkit, enabledToolkits);

  if (!connection.isActive) {
    return null;
  }

  await resolveToolAuthSession(pending.id, 'connected');

  const previousTask = String(pending.callback_context?.originalTask || '').trim();
  if (!previousTask) {
    return null;
  }

  return `The ${pending.toolkit} connection is now active. Resume the previously requested operator task: ${previousTask}`;
}

function buildToolSystemPrompt(context: ToolContext) {
  const toolkitText = enabledToolkitsFromSettings(context.composioSettings, context.capabilities).join(', ');
  const profileFacts = [
    context.businessProfile?.description
      ? `Business description: ${context.businessProfile.description}`
      : null,
    context.businessProfile?.website ? `Website: ${context.businessProfile.website}` : null,
    context.businessProfile?.email ? `Email: ${context.businessProfile.email}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  return `You are an operations agent inside a WhatsApp business inbox.

The sender is an approved operator, so you may use tools to complete tasks.

Enabled toolkits: ${toolkitText || 'none'}
Tool execution mode: operator_only
Read actions may run automatically when safe.
Sensitive or write actions must require explicit confirmation before they execute.

Important behavior:
- Prefer a short answer if no tools are needed.
- If tools are needed, search first, then inspect schema, then execute.
- If a connection is missing or expired, request it with manage_tool_connection.
- Do not guess tool names or required arguments.
- Keep the final WhatsApp reply concise and actionable.
- When approval is required, tell the operator exactly to reply with "confirm".

${profileFacts ? `Business context:\n${profileFacts}` : ''}`.trim();
}

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function buildLocalToolHandlers(): Record<string, LocalToolHandler> {
  return {
    async search_composio_tools(args, context) {
      const intent = String(args.intent || '').trim();
      const toolkits = Array.isArray(args.toolkits)
        ? args.toolkits.map((value) => String(value))
        : undefined;
      return {
        items: await searchTools({
          phone: context.phone,
          intent,
          enabledToolkits: enabledToolkitsFromSettings(context.composioSettings, context.capabilities),
          toolkits,
        }),
      };
    },
    async get_tool_schema(args) {
      const toolSlug = String(args.toolSlug || '').trim();
      return await getToolSchema(toolSlug);
    },
    async list_connected_accounts(_args, context) {
      const items = await listConnectedAccounts(
        context.phone,
        enabledToolkitsFromSettings(context.composioSettings, context.capabilities)
      );
      return { items };
    },
    async manage_tool_connection(args, context) {
      const toolkit = String(args.toolkit || '').trim();
      const action = String(args.action || 'check').trim();
      const enabledToolkits = enabledToolkitsFromSettings(context.composioSettings, context.capabilities);

      if (action === 'check') {
        return await checkConnection(context.phone, toolkit, enabledToolkits);
      }

      const started = await startConnectLink({
        phone: context.phone,
        toolkit,
        enabledToolkits,
      });

      await createToolAuthSession({
        requesterPhone: context.phone,
        toolkit: started.toolkit,
        composioUserId: await getOrCreateComposioUserId(context.phone),
        redirectUrl: started.redirectUrl,
        callbackContext: {
          originalTask: context.latestMessage,
        },
      });

      return {
        status: 'auth_required',
        toolkit: started.toolkit,
        redirectUrl: started.redirectUrl,
        message: `Connect ${started.toolkit} here: ${started.redirectUrl}`,
      };
    },
    async request_approval(args, context) {
      const toolSlug = String(args.toolSlug || '').trim();
      const toolkit = String(args.toolkit || '').trim();
      const actionTitle = String(args.actionTitle || toolSlug).trim();
      const argumentsJson =
        typeof args.arguments === 'object' && args.arguments
          ? (args.arguments as Record<string, unknown>)
          : {};

      const approval = await createToolApproval({
        requesterPhone: context.phone,
        toolkit,
        toolSlug,
        actionTitle,
        argumentsJson,
      });

      await logToolRun({
        requesterPhone: context.phone,
        toolkit,
        toolSlug,
        status: 'approval_requested',
        approvalState: 'pending',
        argumentsSummary: summarizeResult(argumentsJson),
        resultSummary: actionTitle,
      });

      return {
        status: 'approval_required',
        approvalId: approval.id,
        message: `Approval required for "${actionTitle}". Ask the operator to reply with "confirm".`,
      };
    },
    async execute_composio_tool(args, context) {
      const toolSlug = String(args.toolSlug || '').trim();
      const actionTitle = String(args.actionTitle || toolSlug).trim();
      const argumentsJson =
        typeof args.arguments === 'object' && args.arguments
          ? (args.arguments as Record<string, unknown>)
          : {};
      const enabledToolkits = enabledToolkitsFromSettings(context.composioSettings, context.capabilities);
      const schema = await getToolSchema(toolSlug);
      const toolkit = schema.toolkitSlug || 'unknown';

      const connection = await checkConnection(context.phone, toolkit, enabledToolkits);
      if (!connection.isActive) {
        const started = await startConnectLink({
          phone: context.phone,
          toolkit,
          enabledToolkits,
        });

        await createToolAuthSession({
          requesterPhone: context.phone,
          toolkit,
          composioUserId: await getOrCreateComposioUserId(context.phone),
          redirectUrl: started.redirectUrl,
          callbackContext: {
            originalTask: context.latestMessage,
            toolSlug,
            arguments: argumentsJson,
          },
        });

        await logToolRun({
          requesterPhone: context.phone,
          toolkit,
          toolSlug,
          status: 'auth_required',
          approvalState: 'not_required',
          argumentsSummary: summarizeResult(argumentsJson),
          resultSummary: started.redirectUrl,
        });

        return {
          status: 'auth_required',
          toolkit,
          redirectUrl: started.redirectUrl,
          message: `Connect ${toolkit} here before I can continue: ${started.redirectUrl}`,
        };
      }

      if (isLikelyWriteAction(toolSlug, context.composioSettings)) {
        const approval = await createToolApproval({
          requesterPhone: context.phone,
          toolkit,
          toolSlug,
          actionTitle,
          argumentsJson,
        });

        await logToolRun({
          requesterPhone: context.phone,
          toolkit,
          toolSlug,
          status: 'approval_requested',
          approvalState: 'pending',
          argumentsSummary: summarizeResult(argumentsJson),
          resultSummary: actionTitle,
        });

        return {
          status: 'approval_required',
          approvalId: approval.id,
          toolkit,
          message: `I’m ready to ${actionTitle}. Reply with "confirm" to proceed.`,
        };
      }

      const start = Date.now();
      try {
        const result = await executeTool({
          phone: context.phone,
          toolSlug,
          arguments_: argumentsJson,
          enabledToolkits,
        });

        await logToolRun({
          requesterPhone: context.phone,
          toolkit,
          toolSlug,
          status: 'success',
          approvalState: 'not_required',
          argumentsSummary: summarizeResult(argumentsJson),
          resultSummary: summarizeResult(result),
          durationMs: Date.now() - start,
        });

        return {
          status: 'success',
          toolkit,
          toolSlug,
          result,
        };
      } catch (error) {
        const message = sanitizeComposioError(error);
        await logToolRun({
          requesterPhone: context.phone,
          toolkit,
          toolSlug,
          status: 'failed',
          approvalState: 'not_required',
          argumentsSummary: summarizeResult(argumentsJson),
          resultSummary: message,
          durationMs: Date.now() - start,
        });
        return {
          status: 'error',
          toolkit,
          toolSlug,
          message,
        };
      }
    },
  };
}

async function runOpenAiToolLoop(context: ToolContext) {
  const client = getOpenAiClient();
  const handlers = buildLocalToolHandlers();
  const resumeTask = await maybeResumePendingAuth(context);

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: buildToolSystemPrompt(context),
    },
  ];

  const turnsToSend = context.recentTurns.length > 20 ? context.recentTurns.slice(-20) : context.recentTurns;
  for (const turn of turnsToSend) {
    messages.push({ role: turn.role, content: turn.content });
  }

  messages.push({
    role: 'user',
    content: resumeTask || context.latestMessage,
  });

  for (let loop = 0; loop < MAX_TOOL_CALL_LOOPS; loop += 1) {
    const completion = await client.chat.completions.create({
      model: getModel(),
      messages,
      tools: TOOL_DEFS,
      tool_choice: 'auto',
      temperature: 0.2,
      max_tokens: 500,
    });

    const responseMessage = completion.choices[0]?.message;
    if (!responseMessage) {
      break;
    }

    if (!responseMessage.tool_calls?.length) {
      return responseMessage.content?.trim() || '';
    }

    messages.push(responseMessage);

    for (const toolCall of responseMessage.tool_calls) {
      if (toolCall.type !== 'function') {
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: compactJson({ status: 'error', message: `Unsupported tool call type ${toolCall.type}` }),
        });
        continue;
      }

      const handler = handlers[toolCall.function.name];
      const args = safeJsonParse(toolCall.function.arguments || '{}');
      const toolResult = handler
        ? await handler(args, context)
        : { status: 'error', message: `Unknown tool ${toolCall.function.name}` };

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: compactJson(toolResult),
      });
    }
  }

  throw new Error('The tool agent did not finish within the tool loop limit.');
}

export async function generateOperatorAwareReply(context: ToolContext): Promise<ToolAgentResult> {
  const operatorAllowed =
    context.composioSettings.composioEnabled &&
    context.composioSettings.composioApiKeyPresent &&
    context.capabilities?.composioTools &&
    isOperatorPhone(context.phone, context.composioSettings);

  if (!operatorAllowed) {
    return {
      replyText: await generateAgentReply({
        contactName: context.contactName,
        latestMessage: context.latestMessage,
        recentTurns: context.recentTurns,
        capabilities: context.capabilities,
        businessProfile: context.businessProfile,
      }),
      mode: 'plain',
    };
  }

  if (isApprovalMessage(context.latestMessage)) {
    const approval = await getPendingApproval(context.phone);
    if (approval) {
      const replyText = (await executeApprovedTool(approval.id, context)) || 'There is no pending action to confirm.';
      return { replyText, mode: 'operator_tools' };
    }
  }

  try {
    const replyText = await runOpenAiToolLoop(context);
    return {
      replyText: replyText || 'I could not produce a clear operator response for that request.',
      mode: 'operator_tools',
    };
  } catch (error) {
    const fallback = await generateAgentReply({
      contactName: context.contactName,
      latestMessage: context.latestMessage,
      recentTurns: context.recentTurns,
      capabilities: context.capabilities,
      businessProfile: context.businessProfile,
    });

    return {
      replyText:
        fallback ||
        `I hit a tools error while handling that operator request: ${sanitizeOpenAiError(error)}`,
      mode: 'plain',
    };
  }
}

export async function getOperatorActivitySummary(limit = 12) {
  const runs = await fetchRecentToolRuns(limit);
  return runs;
}
