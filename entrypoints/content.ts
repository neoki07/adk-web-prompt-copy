export default defineContentScript({
  matches: ['*://localhost:*/*', '*://127.0.0.1:*/*'],
  main() {
    // Add tooltip and button styles
    const style = document.createElement('style');
    style.textContent = `
      .gemini-copy-tooltip {
        position: fixed;
        background-color: rgba(0, 0, 0, 0.87);
        color: white;
        padding: 6px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-family: Roboto, sans-serif;
        line-height: 1.4;
        white-space: nowrap;
        z-index: 10000;
        pointer-events: none;
        opacity: 0;
        transform: scale(0.8) translateY(-4px);
        transition: opacity 150ms cubic-bezier(0, 0, 0.2, 1),
                    transform 150ms cubic-bezier(0, 0, 0.2, 1);
      }
      
      .gemini-copy-tooltip.show {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
      
      .copy-prompt-button {
        margin-right: var(--gem-sys-spacing--xs);
      }
    `;
    document.head.appendChild(style);
    
    function createTooltip(targetElement: HTMLElement, text: string) {
      const rect = targetElement.getBoundingClientRect();
      
      const tooltip = document.createElement('div');
      tooltip.className = 'gemini-copy-tooltip';
      tooltip.textContent = text;
      
      // Position tooltip below the button
      tooltip.style.left = `${rect.left + rect.width / 2}px`;
      tooltip.style.top = `${rect.bottom + 8}px`;
      tooltip.style.transform = 'translateX(-50%) scale(0.8) translateY(-4px)';
      
      document.body.appendChild(tooltip);
      
      // Show tooltip with animation
      requestAnimationFrame(() => {
        tooltip.classList.add('show');
        tooltip.style.transform = 'translateX(-50%) scale(1) translateY(0)';
      });
      
      return tooltip;
    }
    
    function addCopyButtons() {
      const userMessages = document.querySelectorAll('.user-message');
      
      userMessages.forEach((userMessage) => {
        // Check if copy button already exists
        if (userMessage.querySelector('.copy-prompt-button')) return;
        
        const markdownElement = userMessage.querySelector('markdown');
        if (!markdownElement) return;
        
        const copyButton = document.createElement('button');
        copyButton.className = 'mdc-icon-button mat-mdc-icon-button mat-mdc-button-base mat-mdc-tooltip-trigger copy-prompt-button mat-unthemed';
        copyButton.setAttribute('mat-icon-button', '');
        copyButton.setAttribute('aria-label', 'コピー');
        copyButton.setAttribute('mat-ripple-loader-class-name', 'mat-mdc-button-ripple');
        copyButton.setAttribute('mat-ripple-loader-centered', '');
        
        copyButton.innerHTML = `
          <span class="mat-mdc-button-persistent-ripple mdc-icon-button__ripple"></span>
          <mat-icon role="img" fonticon="content_copy" class="mat-icon notranslate gds-icon-m google-symbols mat-ligature-font mat-icon-no-color" aria-hidden="true" data-mat-icon-type="font" data-mat-icon-name="content_copy">content_copy</mat-icon>
          <span class="mat-focus-indicator"></span>
          <span class="mat-mdc-button-touch-target"></span>
          <span class="mat-ripple mat-mdc-button-ripple"></span>
        `;
        
        let tooltip: HTMLElement | null = null;
        let tooltipTimeout: ReturnType<typeof setTimeout> | null = null;
        
        const removeTooltip = () => {
          if (tooltip) {
            tooltip.classList.remove('show');
            if (tooltipTimeout) clearTimeout(tooltipTimeout);
            tooltipTimeout = setTimeout(() => {
              if (tooltip) {
                tooltip.remove();
                tooltip = null;
              }
            }, 150);
          }
        };
        
        copyButton.addEventListener('mouseenter', () => {
          // Remove any existing tooltips first
          document.querySelectorAll('.gemini-copy-tooltip').forEach(t => t.remove());
          tooltip = createTooltip(copyButton, 'テキストをコピー');
        });
        
        copyButton.addEventListener('mouseleave', removeTooltip);
        
        // Also remove tooltip when scrolling or clicking elsewhere
        copyButton.addEventListener('blur', removeTooltip);
        document.addEventListener('scroll', removeTooltip, { passive: true });
        
        copyButton.addEventListener('click', async () => {
          removeTooltip();
          
          if (!markdownElement) return;
          
          const paragraphs = markdownElement.querySelectorAll('p');
          const text = Array.from(paragraphs)
            .map(p => p.textContent?.trim())
            .filter(text => text)
            .join('\n\n');
          
          try {
            await navigator.clipboard.writeText(text);
            const icon = copyButton.querySelector('mat-icon');
            if (icon) {
              icon.textContent = 'check';
              (icon as HTMLElement).style.color = 'var(--bard-color-code-quotes-and-meta)';
              
              setTimeout(() => {
                icon.textContent = 'content_copy';
                (icon as HTMLElement).style.color = '';
              }, 2000);
            }
          } catch (err) {
            console.error('Failed to copy text:', err);
            const icon = copyButton.querySelector('mat-icon');
            if (icon) {
              icon.textContent = 'error';
              (icon as HTMLElement).style.color = '#ea4335';
              
              setTimeout(() => {
                icon.textContent = 'content_copy';
                (icon as HTMLElement).style.color = '';
              }, 2000);
            }
          }
        });
        
        // Insert the button next to the existing user avatar button
        const avatarButton = userMessage.querySelector('button[mat-mini-fab]');
        if (avatarButton && avatarButton.parentNode) {
          avatarButton.parentNode.insertBefore(copyButton, avatarButton.nextSibling);
        }
      });
    }
    
    const observer = new MutationObserver(() => {
      addCopyButtons();
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    addCopyButtons();
  },
});
