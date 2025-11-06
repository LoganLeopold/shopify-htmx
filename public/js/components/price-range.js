/**
 * Price Range Web Component
 * Displays current price range value and handles slider updates
 */
class PriceRange extends HTMLElement {
  connectedCallback() {
    this.input = this.querySelector('input[type="range"]');
    this.display = this.querySelector('.price-range-display');
    
    if (!this.input) {
      console.warn('PriceRange: missing range input');
      return;
    }
    
    // Create display if it doesn't exist
    if (!this.display) {
      this.display = document.createElement('span');
      this.display.className = 'price-range-display';
      this.input.parentNode.insertBefore(this.display, this.input.nextSibling);
    }
    
    // Update display on input
    this.input.addEventListener('input', () => this.updateDisplay());
    
    // Initial display
    this.updateDisplay();
  }
  
  updateDisplay() {
    const value = parseFloat(this.input.value);
    const max = parseFloat(this.input.max);
    const currency = this.input.getAttribute('data-currency') || '$';
    
    if (value >= max) {
      this.display.textContent = `${currency}${max}+`;
    } else {
      this.display.textContent = `${currency}${value}`;
    }
  }
}

customElements.define('price-range', PriceRange);
