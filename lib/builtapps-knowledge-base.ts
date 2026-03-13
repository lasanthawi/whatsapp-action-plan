export const BUILTAPPS_CANONICAL_WEBSITE = 'https://www.builtapps.eu';

/**
 * Curated knowledge base for the WhatsApp auto-reply agent.
 * Source: public website copy from builtapps.eu.
 * Keep claims conservative and avoid adding unsupported pricing/policy details.
 */
export const BUILTAPPS_KNOWLEDGE_BASE = `
Company profile:
- Builtapps is a custom software and automation partner for Dutch and European SMEs.
- Core focus: reliable digital systems for operations, customer workflows, and internal teams.
- Typical client size and context: SME teams, often with compliance and operational complexity.

Core services:
- Custom web applications.
- Mobile app development.
- Business websites.
- Internal dashboards, portals, and operational systems.
- Business process automation and AI-assisted workflows.

Operating model:
- Discovery and scoping first, then milestone-based development.
- Documentation-first delivery, predictable updates, and written follow-ups.
- Long-term technical partnership and support after launch.

Market positioning:
- Strong fit for Netherlands/EU SME expectations.
- CET-aligned collaboration and structured communication.
- Focus on stability, maintainability, and business outcomes over hype.

Security and compliance:
- GDPR-aware development and data handling.
- Security-first mindset, role-based access patterns, and compliance-aware architecture.
- Data processing clarity (client remains controller, Builtapps acts as processor where applicable).

Typical industries and use cases:
- Professional services, logistics, SaaS, e-commerce, and operations-heavy businesses.
- Internal workflow tools, reporting systems, customer portals, and integrated data flows.

Agent behavior priorities:
- Behave like a technical + marketing team executive: clear, confident, consultative.
- Ask smart discovery questions before proposing solutions.
- Focus on capturing lead details and next steps for a consultation.

Lead qualification checklist (capture progressively):
- Full name
- Company name
- Role/title
- Best email
- Phone/WhatsApp number
- Company website
- Project goal/problem
- Scope (web app, mobile app, website, automation, AI)
- Timeline
- Budget range
`;

export const LEAD_CAPTURE_FIELDS = [
  'name',
  'company',
  'email',
  'phone',
] as const;
