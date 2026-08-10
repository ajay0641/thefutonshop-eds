import { Initializer } from '@dropins/tools/types/elsie/src/lib';
import { Lang } from '@dropins/tools/types/elsie/src/i18n';

type ConfigProps = {
    langDefinitions?: Lang;
    /** Magento store view code header (default: "default") */
    storeViewCode?: string;
    /** Magento website code header (default: "base") */
    websiteCode?: string;
    /** Optional GraphQL endpoint override */
    endpoint?: string;
};
export declare const initialize: Initializer<ConfigProps>;
export declare const config: import('@dropins/tools/types/elsie/src/lib').Config<ConfigProps>;
export {};
//# sourceMappingURL=initialize.d.ts.map