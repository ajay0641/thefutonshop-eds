import { FunctionComponent } from 'preact';
import { HTMLAttributes } from 'preact/compat';
import { ProductSliderItem } from '../../data/models';

export type ProductClickTarget = 'image' | 'name';
export interface ProductCardProps extends HTMLAttributes<HTMLDivElement> {
    product: ProductSliderItem;
    fromLabel?: string;
    saveLabel?: string;
    reviewsLabel?: string;
    reviewLabel?: string;
    /** Fires for image or name click (with which target was used). */
    onProductClick?: (product: ProductSliderItem, target: ProductClickTarget) => void;
    /** Image-only click (also receives `onProductClick` with target "image"). */
    onProductImageClick?: (product: ProductSliderItem) => void;
    /** Name-only click (also receives `onProductClick` with target "name"). */
    onProductNameClick?: (product: ProductSliderItem) => void;
}
export declare const ProductCard: FunctionComponent<ProductCardProps>;
//# sourceMappingURL=ProductCard.d.ts.map