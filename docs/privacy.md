# Privacy and redaction contract

FailLens processes test output locally and writes a normalized failure report.
Input logs are untrusted data: they can contain credentials, personal data,
stack traces, and very large attachments.

## Required behavior

- Redact credentials before writing evidence or diagnostics. This includes
  bearer tokens, common API-key formats, passwords, and secret query values.
- Do not copy raw input into report metadata, diagnostics, reproduction
  commands, or error messages after redaction.
- Preserve the evidence shape (`id`, `kind`, `label`, `content`, `redacted`,
  and `truncated`) so consumers can tell that sanitization occurred.
- Bound every untrusted string before it reaches the report. Oversized content
  must be truncated and marked with `truncated: true`.
- Keep the report deterministic and usable without an AI API key. AI-assisted
  explanations must not be required for redaction or report generation.
- Malformed input must fail closed with a non-zero CLI exit status and a useful
  error; it must not produce a successful, partially interpreted report.

The privacy tests in `tests/privacy/` assert these invariants against the
end-to-end CLI. Add a regression test there whenever a new input format or
secret pattern is introduced.
