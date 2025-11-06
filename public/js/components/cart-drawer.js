/**
 * Cart Drawer Web Component
 * Handles cart drawer open/close animations and updates
 */
class CartDrawer extends HTMLElement {
  connectedCallback() {
    this.drawer = this.querySelector('.cart-drawer');
    this.overlay = this.querySelector('.cart-overlay');
    this.closeBtn = this.querySelector('.cart-close');
    
    if (!this.drawer) {
      console.warn('CartDrawer: missing drawer element');
      return;
    }
    
    // Close button
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.close());
    }
    
    // Overlay click to close
    if (this.overlay) {
      this.overlay.addEventListener('click', () => this.close());
    }
    
    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) {
        this.close();
      }
    });
    
    // Listen for HTMX events to open drawer
    document.body.addEventListener('htmx:afterRequest', (e) => {
      if (e.detail.pathInfo.requestPath.includes('/cart/add')) {
        this.open();
      }
    });
    
    // Listen for custom cart events
    document.body.addEventListener('cart-updated', () => {
      // Refresh cart content if open
      if (this.isOpen()) {
        this.refresh();
      }
    });
  }
  
  isOpen() {
    return this.hasAttribute('open');
  }
  
  open() {
    this.setAttribute('open', '');
    document.body.style.overflow = 'hidden'; // Prevent body scroll
    
    // Focus trap: focus first focusable element
    const firstFocusable = this.drawer.querySelector('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (firstFocusable) {
      firstFocusable.focus();
    }
  }
  
  close() {
    this.removeAttribute('open');
    document.body.style.overflow = '';
  }
  
  async refresh() {
    // Trigger HTMX to refresh cart drawer content
    const drawerContent = this.drawer.querySelector('.cart-drawer-content');
    if (drawerContent && window.htmx) {
      htmx.ajax('GET', '/cart/drawer', {
        target: drawerContent,
        swap: 'innerHTML',
      });
    }
  }
}

customElements.define('cart-drawer', CartDrawer);
