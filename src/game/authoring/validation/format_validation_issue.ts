import type { ValidationIssue } from './validation_types';

export const formatValidationIssue = (issue: ValidationIssue): string => {
    const parts: string[] = [`${issue.severity.toUpperCase()} ${issue.code}`];

    if (issue.path) {
        parts.push(`path=${issue.path}`);
    }
    if (issue.refKind) {
        const refValue = issue.refId ? `${issue.refKind}:${issue.refId}` : issue.refKind;
        parts.push(`ref=${refValue}`);
    } else if (issue.refId) {
        parts.push(`ref=${issue.refId}`);
    }
    if (issue.source) {
        parts.push(`source=${issue.source}`);
    }

    parts.push(issue.message);
    return parts.join(' | ');
};
