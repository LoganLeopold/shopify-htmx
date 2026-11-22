/**
 * <split-text> — kerning-aware text reveal, powered by Griffo
 * https://griffo.dev
 *
 * Wraps a heading (or any text element) and animates its characters, words or
 * lines in with the Web Animations API. Griffo splits the text without
 * destroying kerning, so the text doesn't shift when it is split or when it
 * is restored afterwards.
 *
 *   <split-text type="words" effect="rise">
 *     <h1>Product title</h1>
 *   </split-text>
 *
 * Attributes
 *   type     chars | words | lines (default: words)
 *   effect   rise | fade (default: rise). rise clips each piece with a mask.
 *   stagger  delay between pieces in ms (default: 40)
 *   duration per-piece duration in ms (default: 600)
 *   trigger  visible | load (default: visible), i.e. on scroll into view or immediately
 *
 * Built for HTMX pages:
 *   - Runs on every element HTMX swaps in (custom element upgrades), and
 *     reverts and cleans up when an element is swapped out.
 *   - Before htmx snapshots a page for history, any running animation is
 *     finished and reverted, so back/forward never restores half-split markup.
 *     Restored elements keep data-state="done" and don't replay.
 *   - Waits for document.fonts.ready, so the split is measured against the
 *     final font, not the fallback.
 *   - Honors prefers-reduced-motion. Text that is never animated is never
 *     split.
 *   - The original HTML is restored when the animation finishes
 *     (revertOnComplete), leaving plain, selectable, accessible text in the
 *     DOM. Griffo also labels split text for screen readers while animating.
 *
 * Pre-animation hiding lives in base.css (data-state="pending"/"waiting"),
 * with a CSS failsafe that reveals the text if this module never loads.
 */
import { splitText } from 'griffo';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const TYPES = ['chars', 'words', 'lines'];

const EFFECTS = {
  rise: {
    keyframes: [{ transform: 'translateY(110%)' }, { transform: 'translateY(0)' }],
    mask: true,
  },
  fade: {
    keyframes: [
      { opacity: 0, transform: 'translateY(0.25em)', filter: 'blur(4px)' },
      { opacity: 1, transform: 'translateY(0)', filter: 'blur(0)' },
    ],
    mask: false,
  },
};

class SplitText extends HTMLElement {
  connectedCallback() {
    if (this.dataset.state === 'done') return;

    if (reducedMotion.matches) {
      this.dataset.state = 'done';
      return;
    }

    this.dataset.state = 'waiting';

    if (this.getAttribute('trigger') === 'load') {
      this.play();
      return;
    }

    this.observer = new IntersectionObserver((entries) => {
      if (entries.some(entry => entry.isIntersecting)) {
        this.observer.disconnect();
        this.play();
      }
    }, { rootMargin: '0px 0px -10% 0px' });
    this.observer.observe(this);
  }

  disconnectedCallback() {
    this.observer?.disconnect();
    this.finish();
  }

  get target() {
    return this.firstElementChild || this;
  }

  async play() {
    try {
      await document.fonts.ready;
      // Swapped out (or finished) while waiting for fonts.
      if (!this.isConnected || this.dataset.state !== 'waiting') return;

      const type = TYPES.includes(this.getAttribute('type')) ? this.getAttribute('type') : 'words';
      const effect = EFFECTS[this.getAttribute('effect')] || EFFECTS.rise;
      const stagger = Number(this.getAttribute('stagger') ?? 40);
      const duration = Number(this.getAttribute('duration') ?? 600);

      this.split = splitText(this.target, {
        type,
        mask: effect.mask ? type : undefined,
        revertOnComplete: true,
        onSplit: (result) => {
          const pieces = result[type];
          this.dataset.state = 'animating';
          this.animations = pieces.map((piece, index) => piece.animate(effect.keyframes, {
            duration,
            delay: index * stagger,
            easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)',
            fill: 'backwards',
          }));
          const all = Promise.all(this.animations.map(a => a.finished));
          all.then(() => { this.dataset.state = 'done'; }, () => {});
          // Griffo reverts to the original HTML once these settle.
          return this.animations;
        },
      });
    } catch (error) {
      console.warn('split-text: showing text without animation', error);
      this.finish();
    }
  }

  /** Jump to the end state immediately: original markup, fully visible. */
  finish() {
    this.animations?.forEach(animation => animation.finish());
    this.animations = null;
    this.split?.revert();
    this.split = null;
    this.dataset.state = 'done';
  }
}

if (!customElements.get('split-text')) {
  customElements.define('split-text', SplitText);
}

// Never let htmx snapshot split/mid-animation markup into its history cache.
document.addEventListener('htmx:beforeHistorySave', () => {
  document.querySelectorAll('split-text:not([data-state="done"])').forEach(el => el.finish());
});
