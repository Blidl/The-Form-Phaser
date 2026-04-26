import type { ValidationIssue } from '../../../game/authoring/validation/validation_types';

export type ValidationPanelSeverityFilter = 'all' | 'error' | 'warning' | 'info';

export interface ValidationPanelOptions {
    readonly onIssueFocus?: (issue: ValidationIssue) => void;
}

export interface ValidationPanel {
    render(
        container: HTMLElement,
        issues: readonly ValidationIssue[],
        filter?: ValidationPanelSeverityFilter
    ): void;
    destroy(): void;
}

interface ValidationCounts {
    readonly error: number;
    readonly warning: number;
    readonly info: number;
}

const countBySeverity = (issues: readonly ValidationIssue[]): ValidationCounts => {
    let error = 0;
    let warning = 0;
    let info = 0;

    for (const issue of issues) {
        if (issue.severity === 'error') {
            error += 1;
        } else if (issue.severity === 'warning') {
            warning += 1;
        } else {
            info += 1;
        }
    }

    return { error, warning, info };
};

const formatRef = (issue: ValidationIssue): string | undefined => {
    if (issue.refKind && issue.refId) {
        return `${issue.refKind}:${issue.refId}`;
    }
    if (issue.refKind) {
        return issue.refKind;
    }
    return issue.refId;
};

const appendIssueRow = (
    container: HTMLElement,
    issue: ValidationIssue,
    onIssueFocus?: (issue: ValidationIssue) => void
): void => {
    const row = document.createElement('div');
    row.style.padding = '6px 8px';
    row.style.borderBottom = '1px solid #d8d8d8';

    const header = document.createElement('div');
    header.textContent = `[${issue.severity.toUpperCase()}] ${issue.code}`;
    row.appendChild(header);

    const message = document.createElement('div');
    message.textContent = issue.message;
    row.appendChild(message);

    const metaParts: string[] = [];
    if (issue.path) {
        metaParts.push(`path=${issue.path}`);
    }
    const refValue = formatRef(issue);
    if (refValue) {
        metaParts.push(`ref=${refValue}`);
    }
    if (issue.source) {
        metaParts.push(`source=${issue.source}`);
    }

    if (metaParts.length > 0) {
        const meta = document.createElement('div');
        meta.textContent = metaParts.join(' | ');
        meta.style.fontSize = '12px';
        meta.style.opacity = '0.8';
        row.appendChild(meta);
    }

    if (onIssueFocus) {
        row.style.cursor = 'pointer';
        row.tabIndex = 0;
        row.addEventListener('click', () => {
            onIssueFocus(issue);
        });
        row.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onIssueFocus(issue);
            }
        });
    }

    container.appendChild(row);
};

export const createValidationPanel = (options?: ValidationPanelOptions): ValidationPanel => {
    let currentContainer: HTMLElement | null = null;

    return {
        render(container: HTMLElement, issues: readonly ValidationIssue[], filter: ValidationPanelSeverityFilter = 'all'): void {
            currentContainer = container;
            container.textContent = '';

            const summary = document.createElement('div');
            const counts = countBySeverity(issues);
            summary.textContent = `Errors: ${counts.error} | Warnings: ${counts.warning} | Info: ${counts.info}`;
            summary.style.padding = '8px';
            summary.style.borderBottom = '1px solid #b8b8b8';
            container.appendChild(summary);

            const filteredIssues =
                filter === 'all' ? issues : issues.filter((issue) => issue.severity === filter);

            if (filteredIssues.length === 0) {
                const empty = document.createElement('div');
                empty.textContent = 'No issues for current filter.';
                empty.style.padding = '8px';
                container.appendChild(empty);
                return;
            }

            const list = document.createElement('div');
            for (const issue of filteredIssues) {
                appendIssueRow(list, issue, options?.onIssueFocus);
            }
            container.appendChild(list);
        },
        destroy(): void {
            if (currentContainer) {
                currentContainer.textContent = '';
                currentContainer = null;
            }
        }
    };
};
