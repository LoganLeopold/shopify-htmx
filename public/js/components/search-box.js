/**
 * Search Box Web Component
 * Handles predictive search dropdown, keyboard navigation, and click-outside behavior
 */
class SearchBox extends HTMLElement {
  connectedCallback() {
    this.input = this.querySelector('input[type="search"]');
    this.results = this.querySelector('.search-results');
    
    if (!this.input || !this.results) {
      console.warn('SearchBox: missing input or results container');
      return;
    }
    
    // Show results on focus/input
    this.input.addEventListener('focus', () => this.show());
    this.input.addEventListener('input', () => {
      if (this.input.value.trim()) {
        this.show();
      }
    });
    
    // Hide on blur (but delay to allow click on results)
    this.input.addEventListener('blur', () => {
      setTimeout(() => this.hide(), 200);
    });
    
    // Click outside to close
    document.addEventListener('click', (e) => {
      if (!this.contains(e.target)) {
        this.hide();
      }
    });
    
    // Keyboard navigation
    this.input.addEventListener('keydown', (e) => this.handleKeyboard(e));
    
    // Track selected result index
    this.selectedIndex = -1;
  }
  
  show() {
    this.setAttribute('open', '');
    this.selectedIndex = -1;
  }
  
  hide() {
    this.removeAttribute('open');
    this.selectedIndex = -1;
  }
  
  handleKeyboard(e) {
    if (!this.hasAttribute('open')) {
      if (e.key === 'Enter' && this.input.value.trim()) {
        // Navigate to search page
        window.location.href = `/search?q=${encodeURIComponent(this.input.value)}`;
      }
      return;
    }
    
    const items = this.results.querySelectorAll('a');
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.selectedIndex = Math.min(this.selectedIndex + 1, items.length - 1);
        this.updateSelection(items);
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
        this.updateSelection(items);
        break;
        
      case 'Enter':
        if (this.selectedIndex >= 0 && items[this.selectedIndex]) {
          e.preventDefault();
          items[this.selectedIndex].click();
        } else if (this.input.value.trim()) {
          // Navigate to search page
          window.location.href = `/search?q=${encodeURIComponent(this.input.value)}`;
        }
        break;
        
      case 'Escape':
        e.preventDefault();
        this.hide();
        this.input.blur();
        break;
    }
  }
  
  updateSelection(items) {
    items.forEach((item, index) => {
      if (index === this.selectedIndex) {
        item.setAttribute('aria-selected', 'true');
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.removeAttribute('aria-selected');
      }
    });
  }
}

customElements.define('search-box', SearchBox);
