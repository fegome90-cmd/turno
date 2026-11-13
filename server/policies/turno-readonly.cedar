// No business tools are granted. The SDK's internal schema-output tool is the sole capability.
permit(
    principal == User::"turno-synthetic-agent",
    action == Action::"strands_structured_output",
    resource == Resource::"agent"
)
when {
    context.session.synthetic == true &&
    context.session.review_only == true &&
    context.session.context_ready == true &&
    ["classification", "extraction", "capture"].contains(context.session.stage) &&
    context.session.call_count == 1
};

// Explicit deny protects against an accidental additional broad permit in this policy set.
forbid(principal, action, resource)
when { action != Action::"strands_structured_output" };
