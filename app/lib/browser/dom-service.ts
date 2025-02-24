import { Page } from 'playwright';
import { logger } from '../../utils/logger';
import { playwrightService } from './playwright-service';

interface ElementInfo {
  index: number;
  tag: string;
  type: string;
  text: string;
  attributes: Record<string, string>;
  isVisible: boolean;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  inViewport: boolean;
  zIndex: number;
}

interface DOMState {
  url: string;
  title: string;
  elements: ElementInfo[];
  scrollPosition: {
    x: number;
    y: number;
  };
  viewportSize: {
    width: number;
    height: number;
  };
}

const HIGHLIGHT_COLORS = [
  "#FF0000", "#00FF00", "#0000FF", "#FFA500",
  "#800080", "#008080", "#FF69B4", "#4B0082",
  "#FF4500", "#2E8B57", "#DC143C", "#4682B4"
];

export class DOMService {
  private highlightOverlayEnabled: boolean = false;

  constructor() {
    logger.log('info', { message: 'DOMService initialized' });
  }

  private async getCurrentPage(): Promise<Page> {
    const page = await playwrightService.getPage();
    if (!page) {
      throw new Error('No active page available');
    }
    return page;
  }

  async getPageState(highlightElements: boolean = true): Promise<DOMState> {
    logger.log('info', { message: 'Getting page state', data: { highlightElements } });
    const page = await this.getCurrentPage();

    if (highlightElements && !this.highlightOverlayEnabled) {
      await this.injectHighlightStyles();
      this.highlightOverlayEnabled = true;
    }

    const state = await page.evaluate(({ colors }) => {
      function isElementVisible(element: Element): boolean {
        if (!element.getBoundingClientRect) return false;
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== 'none' && 
               style.visibility !== 'hidden' && 
               style.opacity !== '0' &&
               rect.width > 0 &&
               rect.height > 0;
      }

      function isInViewport(rect: DOMRect): boolean {
        return rect.top >= 0 &&
               rect.left >= 0 &&
               rect.bottom <= window.innerHeight &&
               rect.right <= window.innerWidth;
      }

      function getElementAttributes(element: Element): Record<string, string> {
        const attributes: Record<string, string> = {};
        for (const attr of element.attributes) {
          attributes[attr.name] = attr.value;
        }
        return attributes;
      }

      function isInteractiveElement(element: Element): boolean {
        const tag = element.tagName.toLowerCase();
        const role = element.getAttribute('role');
        const type = (element as HTMLInputElement).type;
        
        // Common interactive elements
        if (['a', 'button', 'input', 'select', 'textarea'].includes(tag)) return true;
        
        // Elements with interactive roles
        if (['button', 'link', 'menuitem', 'option'].includes(role || '')) return true;
        
        // Clickable elements
        if (element.hasAttribute('onclick') || element.hasAttribute('jsaction')) return true;
        
        // Input types that are interactive
        if (tag === 'input' && ['text', 'search', 'number', 'email', 'tel', 'url'].includes(type)) return true;
        
        return false;
      }

      // Remove existing highlights and indices
      document.querySelectorAll('.element-highlight').forEach(el => el.remove());
      document.querySelectorAll('[data-element-index]').forEach(el => {
        el.removeAttribute('data-element-index');
      });

      // Enhanced selector for interactive elements
      const elements = Array.from(document.querySelectorAll(
        'a, button, input, select, textarea, [role="button"], [role="link"], [role="checkbox"], ' +
        '[role="radio"], [role="switch"], [role="menuitem"], [contenteditable="true"], ' +
        '[role="option"], [role="listbox"], [role="combobox"], .dropdown-item, ' +
        '[role="listitem"], [jsaction*="click"], [data-ved], ' +
        '[onclick], [data-click], [class*="clickable"]'
      ));

      // Filter and sort elements by priority
      const prioritizedElements = elements
        .filter(element => {
          const isVisible = isElementVisible(element);
          const isInteractive = isInteractiveElement(element);
          return isVisible && isInteractive;
        })
        .sort((a, b) => {
          const aStyle = window.getComputedStyle(a);
          const bStyle = window.getComputedStyle(b);
          const aZ = parseInt(aStyle.zIndex) || 0;
          const bZ = parseInt(bStyle.zIndex) || 0;
          
          // Prioritize elements in viewport
          const aRect = a.getBoundingClientRect();
          const bRect = b.getBoundingClientRect();
          const aInViewport = isInViewport(aRect);
          const bInViewport = isInViewport(bRect);
          
          if (aInViewport !== bInViewport) {
            return aInViewport ? -1 : 1;
          }
          
          // Then by z-index
          if (aZ !== bZ) {
            return bZ - aZ;
          }
          
          // Then by position (top to bottom)
          return aRect.top - bRect.top;
        })
        .slice(0, 50);

      const elementInfos = prioritizedElements.map((element, index) => {
        const rect = element.getBoundingClientRect();
        const isVisible = isElementVisible(element);
        const inViewport = isInViewport(rect);
        const style = window.getComputedStyle(element);
        const zIndex = parseInt(style.zIndex) || 0;

        // Add data-element-index attribute to the actual element
        element.setAttribute('data-element-index', (index + 1).toString());

        // Create highlight overlay if element is visible
        if (isVisible) {
          const overlay = document.createElement('div');
          overlay.className = 'element-highlight';
          overlay.style.position = 'fixed';
          overlay.style.left = rect.left + 'px';
          overlay.style.top = rect.top + 'px';
          overlay.style.width = rect.width + 'px';
          overlay.style.height = rect.height + 'px';
          overlay.style.border = `2px solid ${colors[index % colors.length]}`;
          overlay.style.backgroundColor = `${colors[index % colors.length]}1A`;
          overlay.style.pointerEvents = 'none';
          overlay.style.zIndex = Math.max(zIndex + 1, 10000).toString();
          
          const label = document.createElement('div');
          label.className = 'element-index';
          label.textContent = (index + 1).toString();
          label.style.position = 'absolute';
          label.style.left = '0';
          label.style.top = '0';
          label.style.background = colors[index % colors.length];
          label.style.color = 'white';
          label.style.padding = '2px 4px';
          label.style.fontSize = '12px';
          label.style.borderRadius = '2px';
          label.style.zIndex = (Math.max(zIndex + 2, 10001)).toString();
          overlay.appendChild(label);

          document.body.appendChild(overlay);
        }

        return {
          index: index + 1,
          tag: element.tagName.toLowerCase(),
          type: (element as HTMLInputElement).type || '',
          text: element.textContent?.trim() || '',
          attributes: getElementAttributes(element),
          isVisible,
          boundingBox: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
          },
          inViewport,
          zIndex
        };
      });

      return {
        url: window.location.href,
        title: document.title,
        elements: elementInfos,
        scrollPosition: {
          x: window.scrollX,
          y: window.scrollY
        },
        viewportSize: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      };
    }, { colors: HIGHLIGHT_COLORS });

    logger.log('info', {
      message: 'Page state retrieved',
      data: {
        url: state.url,
        title: state.title,
        elementCount: state.elements.length,
        viewport: state.viewportSize,
        visibleElements: state.elements.filter(e => e.isVisible).length
      }
    });

    return state;
  }

  private async injectHighlightStyles() {
    logger.log('info', { message: 'Injecting highlight styles' });
    const page = await this.getCurrentPage();
    await page.addStyleTag({
      content: `
        .element-highlight {
          transition: all 0.2s ease-in-out;
          pointer-events: none;
          z-index: 10000;
        }
        .element-index {
          font-family: monospace;
          font-weight: bold;
          pointer-events: none;
        }
      `
    });
  }

  private createStableSelector(attributes: Record<string, string>): string {
    // Create a selector using stable attributes, prioritizing unique identifiers
    const priorityAttrs = ['id', 'href', 'name', 'class', 'role'];
    const selectorParts: string[] = [];
    
    // First try unique identifiers
    if (attributes.id) {
      return `#${CSS.escape(attributes.id)}`;
    }

    // Then try href for links (very common in web apps)
    if (attributes.href && !attributes.href.startsWith('#')) {
      return `a[href="${attributes.href}"]`;
    }

    // Then try combination of other stable attributes
    for (const attr of priorityAttrs) {
      if (attributes[attr] && attr !== 'data-element-index') {
        selectorParts.push(`[${attr}="${attributes[attr]}"]`);
      }
    }

    // If we have text content, use it as a fallback
    if (attributes['text-content']) {
      selectorParts.push(`:contains("${attributes['text-content']}")`);
    }

    return selectorParts.join('');
  }

  async getElementByIndex(index: number): Promise<ElementInfo | null> {
    logger.log('info', { message: 'Getting element by index', data: { index } });
    const state = await this.getPageState(false);
    const element = state.elements.find(e => e.index === index) ?? null;
    
    if (element) {
      // Store text content in attributes for stable selector creation
      if (element.text) {
        element.attributes['text-content'] = element.text;
      }
      
      logger.log('info', {
        message: 'Found element',
        data: {
          tag: element.tag,
          type: element.type,
          isVisible: element.isVisible,
          selector: this.createStableSelector(element.attributes)
        }
      });
    } else {
      logger.log('info', { message: 'Element not found' });
    }
    return element;
  }

  async scrollToElement(index: number, providedSelector?: string, boundingBoxOverride?: { x: number; y: number; width: number; height: number; }) {
    logger.log('info', { message: 'Scrolling to element', data: { index } });
    const page = await this.getCurrentPage();
    let stableSelector: string;
    let fallbackBox: { x: number; y: number; width: number; height: number; } | undefined;

    if (providedSelector) {
      stableSelector = providedSelector;
      // Use the provided bounding box if available, do not re-read page state to avoid reindexing
      fallbackBox = boundingBoxOverride;
      if (!fallbackBox) {
        logger.log('warn', { message: 'No fallback bounding box provided with stable selector', data: { index, selector: stableSelector } });
      }
    } else {
      const element = await this.getElementByIndex(index);
      if (!element || !element.boundingBox) {
        logger.error({ message: 'Element not found for scrolling', data: { index } });
        return false;
      }
      stableSelector = this.createStableSelector(element.attributes);
      fallbackBox = element.boundingBox;
    }

    try {
      // First attempt: scroll into view using the stable selector
      await page.evaluate(async (selector) => {
        const el = document.querySelector(selector);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return true;
        }
        return false;
      }, stableSelector);

      // Wait for scroll to complete
      await page.waitForTimeout(1000);

      // Verify element is visible in viewport
      const isVisible = await page.evaluate((selector) => {
        const el = document.querySelector(selector);
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.top >= 0 && rect.bottom <= window.innerHeight && rect.width > 0 && rect.height > 0;
      }, stableSelector);

      if (!isVisible && fallbackBox) {
        // Fallback to absolute positioning if scrollIntoView didn't bring the element into view
        await page.evaluate(({ x, y }) => {
          window.scrollTo({
            left: x,
            top: Math.max(0, y - 100),
            behavior: 'smooth'
          });
        }, fallbackBox);
        await page.waitForTimeout(500);
      }

      // Final verification
      const finalCheck = await page.evaluate((selector) => {
        return document.querySelector(selector) !== null;
      }, stableSelector);

      if (!finalCheck) {
        logger.error({
          message: 'Element not found after scrolling',
          data: { index, selector: stableSelector }
        });
        return false;
      }

      logger.log('info', {
        message: 'Successfully scrolled to element',
        data: { index, selector: stableSelector }
      });
      return true;
    } catch (error) {
      logger.error({
        message: 'Error scrolling to element',
        data: { index, error }
      });
      return false;
    }
  }

  async validateElement(index: number): Promise<boolean> {
    logger.log('info', { message: 'Validating element', data: { index } });
    const element = await this.getElementByIndex(index);
    const isValid = element !== null && element.isVisible;
    logger.log('info', { message: 'Element validation result', data: { index, isValid } });
    return isValid;
  }

  async getFormattedElements(): Promise<string> {
    logger.log('info', { message: 'Getting formatted elements' });
    const state = await this.getPageState(false);
    return state.elements.map(element => {
      const attrs = Object.entries(element.attributes)
        .map(([key, value]) => `${key}="${value}"`)
        .join(' ');
      
      return `[${element.index}] <${element.tag} ${attrs}>${element.text}</${element.tag}>`;
    }).join('\n');
  }

  async cleanup() {
    logger.log('info', { message: 'Cleaning up DOM service' });
    const page = await this.getCurrentPage();
    if (this.highlightOverlayEnabled) {
      await page.evaluate(() => {
        document.querySelectorAll('.element-highlight').forEach(el => el.remove());
        document.querySelectorAll('[data-element-index]').forEach(el => {
          el.removeAttribute('data-element-index');
        });
      });
      this.highlightOverlayEnabled = false;
    }
  }

  async clickElement(index: number): Promise<boolean> {
    logger.log('info', { message: 'Clicking element by index', data: { index } });
    const page = await this.getCurrentPage();
    
    // Get the element info once and compute base stable selector
    const element = await this.getElementByIndex(index);
    if (!element) {
      logger.error({ message: 'Element not found for clicking', data: { index } });
      return false;
    }
    const baseStableSelector = this.createStableSelector(element.attributes);
    
    // Inject a custom stable attribute so that the element reference remains stable
    const uniqueId = `stable-${Date.now()}-${index}`;
    await page.evaluate((selector, uniqueId) => {
      const el = document.querySelector(selector);
      if (el) {
        el.setAttribute('data-stable-id', uniqueId);
      }
    }, baseStableSelector, uniqueId);
    
    // Use the custom attribute for a stable selector
    const stableSelector = `[data-stable-id="${uniqueId}"]`;
    
    try {
      // Scroll into view using our stable selector and known bounding box
      const scrollSuccess = await this.scrollToElement(index, stableSelector, element.boundingBox);
      if (!scrollSuccess) {
        logger.error({ message: 'Failed to scroll to element before clicking', data: { index } });
        return false;
      }

      // Wait for any dynamic content to settle
      await page.waitForTimeout(500);

      // If the element has target='_blank', wait for a popup window
      if (element.attributes['target'] === '_blank') {
        const [newPage] = await Promise.all([
          page.waitForEvent('popup'),
          page.click(stableSelector, { timeout: 5000, force: false })
        ]);
        logger.log('info', { message: 'Successfully opened new page via popup', data: { index, selector: stableSelector } });
        // Optionally update the playwrightService with the new page if needed
      } else {
        // Click the element using the stable selector
        await page.click(stableSelector, {
          timeout: 5000,
          force: false
        });
      }

      logger.log('info', {
        message: 'Successfully clicked element',
        data: { index, selector: stableSelector }
      });
      return true;
    } catch (error) {
      // If Playwright click fails, try JavaScript click fallback
      try {
        const clicked = await page.evaluate((selector) => {
          const el = document.querySelector(selector);
          if (el && el instanceof HTMLElement) {
            el.click();
            return true;
          }
          return false;
        }, stableSelector);

        if (clicked) {
          logger.log('info', {
            message: 'Successfully clicked element using JS fallback',
            data: { index, selector: stableSelector }
          });
          return true;
        }

        logger.error({
          message: 'Failed to click element with both methods',
          data: { index, selector: stableSelector }
        });
        return false;
      } catch (jsError) {
        logger.error({
          message: 'Failed to click element',
          data: { index, selector: stableSelector, error: jsError }
        });
        return false;
      }
    }
  }
} 