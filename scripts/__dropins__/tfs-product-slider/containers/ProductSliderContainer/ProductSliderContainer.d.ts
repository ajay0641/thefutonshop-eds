import { HTMLAttributes } from 'preact/compat';
import { Container } from '@dropins/tools/types/elsie/src/lib';
import { GetProductSliderOptions, ProductSliderItem, ProductSliderResult } from '../../data/models';

export interface ProductSliderContainerProps extends HTMLAttributes<HTMLDivElement>, GetProductSliderOptions {
    /** Optional heading above the slider */
    title?: string;
    /**
     * Optional custom fetch. When provided, replaces the default productSearch call.
     * Use this to power the same slider UI from a different API / query.
     */
    fetchProducts?: () => Promise<ProductSliderResult>;
    onLoad?: (result: ProductSliderResult) => void;
    onError?: (payload: {
        message: string;
    }) => void;
    /** Shared handler for image or name clicks (`target` is which one). */
    onProductClick?: (product: ProductSliderItem, target: 'image' | 'name') => void;
    onProductImageClick?: (product: ProductSliderItem) => void;
    onProductNameClick?: (product: ProductSliderItem) => void;
}
export declare const ProductSliderContainer: Container<ProductSliderContainerProps>;
//# sourceMappingURL=ProductSliderContainer.d.ts.map