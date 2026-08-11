import { FunctionComponent } from 'preact';
import { HTMLAttributes } from 'preact/compat';
import { ProductSliderItem } from '../../data/models';

export interface ProductCardProps extends HTMLAttributes<HTMLAnchorElement> {
    product: ProductSliderItem;
    fromLabel?: string;
    saveLabel?: string;
    reviewsLabel?: string;
    reviewLabel?: string;
    onProductClick?: (product: ProductSliderItem) => void;
}
export declare const ProductCard: FunctionComponent<ProductCardProps>;
//# sourceMappingURL=ProductCard.d.ts.map