/**
 * Image Gallery Web Component
 * Handles product image gallery navigation and zoom
 */
class ImageGallery extends HTMLElement {
  connectedCallback() {
    this.mainImage = this.querySelector('.gallery-main img');
    this.thumbnails = this.querySelectorAll('.gallery-thumb');
    this.currentIndex = Math.max(0, [...this.thumbnails].findIndex(t => t.classList.contains('active')));
    
    if (!this.mainImage) {
      console.warn('ImageGallery: missing main image');
      return;
    }
    
    // Thumbnail click handlers
    this.thumbnails.forEach((thumb, index) => {
      thumb.addEventListener('click', () => this.setImage(index));
      thumb.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.setImage(index);
        }
      });
    });
    
    // Keyboard navigation
    this.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          this.previous();
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.next();
          break;
      }
    });
    
    // Zoom on hover (optional enhancement)
    if (this.mainImage) {
      this.mainImage.addEventListener('mousemove', (e) => this.handleZoom(e));
      this.mainImage.addEventListener('mouseleave', () => this.resetZoom());
    }
    
    // Make gallery focusable for keyboard nav
    this.setAttribute('tabindex', '0');
    
    // Variant changes (server sends `variant:update` via HX-Trigger): show
    // the selected variant's image if it belongs to this gallery's section.
    this.onVariantUpdate = (event) => {
      const { sectionId, imageIndex } = event.detail || {};
      if (sectionId !== this.dataset.sectionId) return;
      if (Number.isInteger(imageIndex) && imageIndex >= 0) this.setImage(imageIndex);
    };
    document.addEventListener('variant:update', this.onVariantUpdate);
  }
  
  disconnectedCallback() {
    document.removeEventListener('variant:update', this.onVariantUpdate);
  }
  
  setImage(index) {
    if (index < 0 || index >= this.thumbnails.length) return;
    if (index === this.currentIndex && this.thumbnails[index].classList.contains('active')) return;
    
    this.currentIndex = index;
    const thumbnail = this.thumbnails[index];
    const newSrc = thumbnail.getAttribute('data-src') || thumbnail.src;
    
    if (this.mainImage) {
      this.mainImage.src = newSrc;
      this.mainImage.alt = thumbnail.alt || '';
    }
    
    // Update active thumbnail
    this.thumbnails.forEach((thumb, i) => {
      if (i === index) {
        thumb.setAttribute('aria-selected', 'true');
        thumb.classList.add('active');
      } else {
        thumb.removeAttribute('aria-selected');
        thumb.classList.remove('active');
      }
    });
  }
  
  next() {
    const nextIndex = (this.currentIndex + 1) % this.thumbnails.length;
    this.setImage(nextIndex);
  }
  
  previous() {
    const prevIndex = (this.currentIndex - 1 + this.thumbnails.length) % this.thumbnails.length;
    this.setImage(prevIndex);
  }
  
  handleZoom(e) {
    if (!this.mainImage) return;
    
    const rect = this.mainImage.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    this.mainImage.style.transformOrigin = `${x}% ${y}%`;
    this.mainImage.style.transform = 'scale(1.5)';
    this.mainImage.style.transition = 'transform 0.1s ease-out';
  }
  
  resetZoom() {
    if (this.mainImage) {
      this.mainImage.style.transform = 'scale(1)';
    }
  }
}

customElements.define('image-gallery', ImageGallery);
