"""Draft a suspicious activity report (SAR) for analyst review.

Template version for now. The Claude version plugs in here once the
Anthropic key is set (PRD 6.7).
"""
from datetime import date


def draft(state: dict) -> str:
    intel = state["intel"]
    blocked = [a for a in state["accounts"] if a["status"] == "blocked"]
    imp = state["impact"]
    lines = [
        "# SUSPICIOUS ACTIVITY REPORT — DRAFT",
        "**Analyst review required before filing.**",
        "",
        f"**Filing institution:** CalHacks Federal Credit Union  ",
        f"**Date:** {date.today().isoformat()}  ",
        f"**Case source:** Decoy line call `{state['call']['id']}`",
        "",
        "## Subjects",
    ]
    for a in blocked:
        lines.append(f"- Account `{a['number']}` at {a['bank']} (routing `{a['routing']}`)")
    lines += [
        f"- Caller claimed to be **{intel.get('name', 'unknown')}** of **{intel.get('agency', 'unknown agency')}**, "
        f"badge `{intel.get('badge', 'n/a')}`, callback `{intel.get('callback', 'n/a')}`",
        "",
        "## Suspicious activity",
        "Government-impersonation \"safe account\" scam (phantom hacker pattern). The caller pressured the "
        "decoy to move savings into the accounts above.",
        "",
        "## Related transactions",
    ]
    for h in imp["holds"]:
        lines.append(f"- HELD: ${h['amount']:,.0f} pending wire from {h['customer']} ({h['age']})")
    for v in imp["lookback"]:
        lines.append(f"- RECALL REQUESTED: ${v['amount']:,.0f} from {v['customer']} ({v['age']}), {v['days_ago']} days ago")
    lines += [
        "",
        f"**Total amount involved:** ${imp['protected_total']:,.0f}",
        "",
        "## Narrative",
        f"Stages observed: {', '.join(state['stages_seen'])}. The caller requested a transfer to a "
        "\"protected\" account and provided routing and account numbers. Automated holds were placed on "
        "pending transfers; completed transfers in the last 30 days were flagged for recall. "
        "No real customer data was disclosed and no funds were moved by the decoy.",
    ]
    return "\n".join(lines)
