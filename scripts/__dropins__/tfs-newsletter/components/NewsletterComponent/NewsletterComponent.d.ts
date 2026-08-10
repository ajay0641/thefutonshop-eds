import { FunctionComponent } from 'preact';
import { HTMLAttributes } from 'preact/compat';

export interface NewsletterComponentProps extends HTMLAttributes<HTMLDivElement> {
    emailPlaceholder?: string;
    submitLabel?: string;
    submittingLabel?: string;
    email?: string;
    loading?: boolean;
    emailError?: string | null;
    onEmailChange?: (email: string) => void;
    onSubmit?: (email: string) => void;
}
export declare const NewsletterComponent: FunctionComponent<NewsletterComponentProps>;
//# sourceMappingURL=NewsletterComponent.d.ts.map