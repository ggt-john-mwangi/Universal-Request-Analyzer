/**
 * BaseComponent - Abstract base class for all UI components
 * Provides common functionality for component lifecycle and event handling
 */
export class BaseComponent {
  constructor(elementId, options = {}) {
    this.elementId = elementId;
    this.element = null;
    this.options = options;
    this.eventHandlers = new Map();
    this.state = {};
    this.isInitialized = false;
  }

  /**
   * Initialize the component
   */
  async initialize() {
    if (this.isInitialized) {
      console.warn(`Component ${this.constructor.name} already initialized`);
      return;
    }

    this.element = document.getElementById(this.elementId);
    
    if (!this.element) {
      throw new Error(`Element with id ${this.elementId} not found`);
    }

    await this.onInit();
    this.setupEventListeners();
    this.isInitialized = true;
    
    console.log(`Component ${this.constructor.name} initialized`);
  }

  /**
   * Called during initialization - override in subclasses
   */
  async onInit() {
    // Override in subclasses
  }

  /**
   * Setup event listeners - override in subclasses
   */
  setupEventListeners() {
    // Override in subclasses
  }

  /**
   * Update component state
   */
  setState(newState) {
    this.state = { ...this.state, ...newState };
    this.render();
  }

  /**
   * Get current state
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Render the component - override in subclasses
   */
  render() {
    // Override in subclasses
  }

  /**
   * Add event listener with automatic cleanup tracking
   */
  addEventListener(target, event, handler, options) {
    const element = typeof target === 'string' 
      ? document.querySelector(target) 
      : target;

    if (!element) {
      console.warn(`Target not found for event ${event}`);
      return;
    }

    element.addEventListener(event, handler, options);
    
    // Track for cleanup
    const key = `${event}-${Date.now()}`;
    this.eventHandlers.set(key, { element, event, handler, options });
  }

  /**
   * Emit custom event
   */
  emit(eventName, detail = {}) {
    const event = new CustomEvent(eventName, {
      detail,
      bubbles: true,
      cancelable: true
    });
    
    if (this.element) {
      this.element.dispatchEvent(event);
    }
  }

  /**
   * Listen for custom events
   */
  on(eventName, handler) {
    this.addEventListener(this.element, eventName, handler);
  }

  /**
   * Show the component
   */
  show() {
    if (this.element) {
      this.element.style.display = '';
      this.element.classList.remove('hidden');
    }
  }

  /**
   * Hide the component
   */
  hide() {
    if (this.element) {
      this.element.style.display = 'none';
      this.element.classList.add('hidden');
    }
  }

  /**
   * Enable the component
   */
  enable() {
    if (this.element) {
      this.element.disabled = false;
      this.element.classList.remove('disabled');
    }
  }

  /**
   * Disable the component
   */
  disable() {
    if (this.element) {
      this.element.disabled = true;
      this.element.classList.add('disabled');
    }
  }

  /**
   * Cleanup and destroy the component
   */
  destroy() {
    // Remove all tracked event listeners
    this.eventHandlers.forEach(({ element, event, handler, options }) => {
      element.removeEventListener(event, handler, options);
    });
    this.eventHandlers.clear();

    // Call cleanup hook
    this.onDestroy();

    this.isInitialized = false;
    this.element = null;
    
    console.log(`Component ${this.constructor.name} destroyed`);
  }

  /**
   * Called during destruction - override in subclasses
   */
  onDestroy() {
    // Override in subclasses
  }

  /**
   * Show loading state
   */
  showLoading(message = 'Loading...') {
    if (this.element) {
      this.element.classList.add('loading');
      this.element.setAttribute('aria-busy', 'true');
      
      // You can add a loading spinner here if needed
      const loadingEl = document.createElement('div');
      loadingEl.className = 'loading-spinner';
      loadingEl.textContent = message;
      loadingEl.setAttribute('data-loading', 'true');
      this.element.appendChild(loadingEl);
    }
  }

  /**
   * Hide loading state
   */
  hideLoading() {
    if (this.element) {
      this.element.classList.remove('loading');
      this.element.setAttribute('aria-busy', 'false');
      
      const loadingEl = this.element.querySelector('[data-loading="true"]');
      if (loadingEl) {
        loadingEl.remove();
      }
    }
  }

  /**
   * Show error message
   */
  showError(message) {
    this.emit('component:error', { message });
    console.error(`${this.constructor.name}: ${message}`);
  }

  /**
   * Create element helper
   */
  createElement(tag, className = '', attributes = {}) {
    const element = document.createElement(tag);
    
    if (className) {
      element.className = className;
    }
    
    Object.entries(attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
    
    return element;
  }

  /**
   * Query selector within component
   */
  $(selector) {
    return this.element ? this.element.querySelector(selector) : null;
  }

  /**
   * Query selector all within component
   */
  $$(selector) {
    return this.element ? Array.from(this.element.querySelectorAll(selector)) : [];
  }
}
