import { HTMLAttributes } from 'preact/compat';
import { Container } from '@dropins/tools/types/elsie/src/lib';

export interface NewsletterContainerProps extends HTMLAttributes<HTMLDivElement> {
    /** Called after a successful subscription */
    onSuccess?: (payload: {
        email: string;
        status: string;
    }) => void;
    /** Called when subscription fails */
    onError?: (payload: {
        email: string;
        message: string;
    }) => void;
}
export declare const NewsletterContainer: Container<NewsletterContainerProps>;
//# sourceMappingURL=NewsletterContainer.d.ts.map