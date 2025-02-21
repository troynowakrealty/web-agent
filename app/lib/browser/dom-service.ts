import { Page } from 'playwright';
import { logger } from '../../utils/logger';

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
  private page: Page;
  private highlightOverlayEnabled: boolean = false;

  constructor(page: Page) {
    this.page = page;
    logger.log('DOMService initialized');
  }

  async getPageState(highlightElements: boolean = true): Promise<DOMState> {
    logger.log('Getting page state, highlight elements:', highlightElements);

    if (highlightElements && !this.highlightOverlayEnabled) {
      await this.injectHighlightStyles();
      this.highlightOverlayEnabled = true;
    }

    const state = await this.page.evaluate(({ colors }) => {
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

      // Remove existing highlights and indices
      document.querySelectorAll('.element-highlight').forEach(el => el.remove());
      document.querySelectorAll('[data-element-index]').forEach(el => {
        el.removeAttribute('data-element-index');
      });

      // Find interactive elements
      const elements = Array.from(document.querySelectorAll(
        'a, button, input, select, textarea, [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="switch"], [role="menuitem"], [contenteditable="true"]'
      ));

      const elementInfos = elements.map((element, index) => {
        const rect = element.getBoundingClientRect();
        const isVisible = isElementVisible(element);
        const inViewport = isInViewport(rect);

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
          overlay.style.zIndex = '10000';
          
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
          inViewport
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

    logger.log('Page state retrieved:', {
      url: state.url,
      title: state.title,
      elementCount: state.elements.length,
      viewport: state.viewportSize,
      visibleElements: state.elements.filter(e => e.isVisible).length
    });

    return state;
  }

  private async injectHighlightStyles() {
    logger.log('Injecting highlight styles');
    await this.page.addStyleTag({
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

  async scrollToElement(index: number) {
    logger.log('Scrolling to element:', index);
    const state = await this.getPageState(false);
    const element = state.elements.find(e => e.index === index);
    
    if (element && element.boundingBox) {
      await this.page.evaluate(({ x, y }) => {
        window.scrollTo({
          left: x,
          top: y,
          behavior: 'smooth'
        });
      }, {
        x: element.boundingBox.x,
        y: element.boundingBox.y
      });

      // Wait for scroll to complete
      await this.page.waitForTimeout(500);
      logger.log('Scrolled to element position:', element.boundingBox);
    } else {
      logger.error('Element not found for scrolling:', index);
    }
  }

  async getElementByIndex(index: number): Promise<ElementInfo | null> {
    logger.log('Getting element by index:', index);
    const state = await this.getPageState(false);
    const element = state.elements.find(e => e.index === index) ?? null;
    if (element) {
      logger.log('Found element:', {
        tag: element.tag,
        type: element.type,
        isVisible: element.isVisible
      });
    } else {
      logger.log('Element not found');
    }
    return element;
  }

  async validateElement(index: number): Promise<boolean> {
    logger.log('Validating element:', index);
    const element = await this.getElementByIndex(index);
    const isValid = element !== null && element.isVisible;
    logger.log('Element validation result:', { index, isValid });
    return isValid;
  }

  async getFormattedElements(): Promise<string> {
    logger.log('Getting formatted elements');
    const state = await this.getPageState(false);
    return state.elements.map(element => {
      const attrs = Object.entries(element.attributes)
        .map(([key, value]) => `${key}="${value}"`)
        .join(' ');
      
      return `[${element.index}] <${element.tag} ${attrs}>${element.text}</${element.tag}>`;
    }).join('\n');
  }

  async cleanup() {
    logger.log('Cleaning up DOM service');
    if (this.highlightOverlayEnabled) {
      await this.page.evaluate(() => {
        document.querySelectorAll('.element-highlight').forEach(el => el.remove());
        document.querySelectorAll('[data-element-index]').forEach(el => {
          el.removeAttribute('data-element-index');
        });
      });
      this.highlightOverlayEnabled = false;
    }
  }
} 