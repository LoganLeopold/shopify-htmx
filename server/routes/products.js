import express from 'express';
import { getProduct } from '../services/shopify.js';
import { sendSections } from '../lib/sections.js';
import { productSectionData, selectionFromRequest } from '../lib/product-view.js';
import { legacyId } from '../lib/format.js';

const router = express.Router();

// Sections that can be rendered in a product's context via ?section_id= / ?sections=
const PRODUCT_SECTIONS = ['main-product', 'featured-product'];

// Product detail page (+ Section Rendering API)
router.get('/:handle', async (req, res, next) => {
  try {
    const { handle } = req.params;
    const product = await getProduct(handle);

    if (!product) {
      return res.status(404).render('404', {
        layout: 'layouts/base',
        title: 'Product Not Found',
      });
    }

    const data = productSectionData(product, selectionFromRequest(req));

    if (res.locals.isHTMX && req.query.section_id) {
      // Horizon-style variant:update event: lets components outside the
      // swapped blocks (the media gallery) react without being re-rendered.
      res.set('HX-Trigger', JSON.stringify({
        'variant:update': {
          sectionId: req.query.section_id,
          variantId: data.variant.id,
          imageIndex: data.selectedImageIndex,
          available: data.variant.availableForSale,
        },
      }));

      // Like Horizon, the PDP's URL tracks the selected variant (shareable,
      // reload-safe). A featured product elsewhere leaves the URL alone.
      if (req.query.section_id === 'main-product') {
        res.set('HX-Replace-Url', `/products/${product.handle}?variant=${legacyId(data.variant.id)}`);
      }
    }

    const handled = await sendSections(req, res, PRODUCT_SECTIONS, { ...data, announce: true });
    if (handled) return;

    res.render('pages/product', {
      ...data,
      layout: 'layouts/base',
      title: product.title,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
