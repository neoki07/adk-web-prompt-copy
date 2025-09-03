import TurndownService from "turndown";

export default defineContentScript({
  matches: ["<all_urls>"],
  main() {
    // Early exit if not ADK Web
    if (!isADKWeb()) {
      return;
    }
    // Add tooltip and button styles
    const style = document.createElement("style");
    style.textContent = `
      .adk-copy-tooltip {
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
      
      .adk-copy-tooltip.show {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
      
      .copy-prompt-button {
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 6px;
        padding: 4px 8px;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.8);
        cursor: pointer;
        transition: all 0.2s ease;
        min-width: 0;
        width: auto;
        height: auto;
        display: flex;
        align-items: center;
        gap: 4px;
        margin-right: 8px;
        flex-shrink: 0;
      }
      
      .copy-prompt-button:hover {
        background: rgba(255, 255, 255, 0.2);
        border-color: rgba(255, 255, 255, 0.3);
        color: white;
      }
      
      .copy-prompt-button mat-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
      }
      
      /* Consistent spacing for different message types */
      .user-message .copy-prompt-button {
        margin-right: 8px;
      }
      
      .bot-message .copy-prompt-button {
        margin-left: 8px;
      }
      
      /* Prevent focus-within interference for copy buttons */
      .bot-message:has(.copy-prompt-button:focus) .message-card,
      .bot-message:has(.copy-prompt-button:active) .message-card {
        background-color: #303030 !important;
        border: none !important;
      }
    `;
    document.head.appendChild(style);

    function createTooltip(targetElement: HTMLElement, text: string) {
      const rect = targetElement.getBoundingClientRect();

      const tooltip = document.createElement("div");
      tooltip.className = "adk-copy-tooltip";
      tooltip.textContent = text;

      // Position tooltip below the button
      tooltip.style.left = `${rect.left + rect.width / 2}px`;
      tooltip.style.top = `${rect.bottom + 8}px`;
      tooltip.style.transform = "translateX(-50%) scale(0.8) translateY(-4px)";

      document.body.appendChild(tooltip);

      // Show tooltip with animation
      requestAnimationFrame(() => {
        tooltip.classList.add("show");
        tooltip.style.transform = "translateX(-50%) scale(1) translateY(0)";
      });

      return tooltip;
    }

    // Check if we're in a secure context for clipboard API
    function isSecureContext(): boolean {
      return (
        window.isSecureContext &&
        !!navigator.clipboard &&
        !!navigator.clipboard.writeText
      );
    }

    // Fallback copy function for non-secure contexts
    function fallbackCopyTextToClipboard(text: string): Promise<void> {
      return new Promise((resolve, reject) => {
        const textArea = document.createElement("textarea");
        textArea.value = text;

        // Make the textarea invisible but accessible
        textArea.style.position = "fixed";
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.width = "2em";
        textArea.style.height = "2em";
        textArea.style.padding = "0";
        textArea.style.border = "none";
        textArea.style.outline = "none";
        textArea.style.boxShadow = "none";
        textArea.style.background = "transparent";
        textArea.style.opacity = "0";
        textArea.style.pointerEvents = "none";

        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
          const successful = document.execCommand("copy");
          document.body.removeChild(textArea);

          if (successful) {
            resolve();
          } else {
            reject(new Error('document.execCommand("copy") failed'));
          }
        } catch (err) {
          document.body.removeChild(textArea);
          reject(err);
        }
      });
    }

    // Main copy function with fallback
    async function copyTextToClipboard(text: string): Promise<void> {
      if (isSecureContext()) {
        // Use modern clipboard API for secure contexts
        await navigator.clipboard.writeText(text);
      } else {
        // Use fallback for non-secure contexts (HTTP sites)
        await fallbackCopyTextToClipboard(text);
      }
    }

    // Show success feedback
    function showCopySuccess(copyButton: HTMLElement) {
      const icon = copyButton.querySelector("mat-icon");
      if (icon) {
        icon.textContent = "check";
        (icon as HTMLElement).style.color =
          "var(--bard-color-code-quotes-and-meta)";

        setTimeout(() => {
          icon.textContent = "content_copy";
          (icon as HTMLElement).style.color = "";
        }, 2000);
      }
    }

    // Show error feedback
    function showCopyError(copyButton: HTMLElement) {
      const icon = copyButton.querySelector("mat-icon");
      if (icon) {
        icon.textContent = "error";
        (icon as HTMLElement).style.color = "#ea4335";

        setTimeout(() => {
          icon.textContent = "content_copy";
          (icon as HTMLElement).style.color = "";
        }, 2000);
      }
    }

    function addCopyButtons() {
      const allMessages = document.querySelectorAll(
        ".user-message, .bot-message"
      );

      allMessages.forEach((message) => {
        // Check if copy button already exists
        if (message.querySelector(".copy-prompt-button")) return;

        const markdownElement = message.querySelector("markdown");
        if (!markdownElement) return;

        const copyButton = document.createElement("button");
        copyButton.className = "copy-prompt-button";
        copyButton.setAttribute("aria-label", "コピー");

        copyButton.innerHTML = `
          <mat-icon role="img" class="mat-icon notranslate material-icons mat-ligature-font mat-icon-no-color" aria-hidden="true" data-mat-icon-type="font">content_copy</mat-icon>
          <span>コピー</span>
        `;

        let tooltip: HTMLElement | null = null;
        let tooltipTimeout: ReturnType<typeof setTimeout> | null = null;

        const removeTooltip = () => {
          if (tooltip) {
            tooltip.classList.remove("show");
            if (tooltipTimeout) clearTimeout(tooltipTimeout);
            tooltipTimeout = setTimeout(() => {
              if (tooltip) {
                tooltip.remove();
                tooltip = null;
              }
            }, 150);
          }
        };

        copyButton.addEventListener("mouseenter", () => {
          // Remove any existing tooltips first
          document
            .querySelectorAll(".adk-copy-tooltip")
            .forEach((t) => t.remove());

          const tooltipText = "テキストをコピー";
          tooltip = createTooltip(copyButton, tooltipText);
        });

        copyButton.addEventListener("mouseleave", removeTooltip);

        // Also remove tooltip when scrolling or clicking elsewhere
        copyButton.addEventListener("blur", removeTooltip);
        document.addEventListener("scroll", removeTooltip, { passive: true });

        copyButton.addEventListener("click", async (event) => {
          removeTooltip();

          // Prevent focus and event bubbling to avoid UI interference
          event.preventDefault();
          event.stopPropagation();
          copyButton.blur();

          if (!markdownElement) return;

          // Convert HTML to Markdown using Turndown
          const turndownService = new TurndownService({
            headingStyle: "atx", // Use # style headings (modern standard)
            hr: "---", // Use --- for horizontal rules (most common)
            bulletListMarker: "-", // Use - for bullet lists (modern standard)
            codeBlockStyle: "fenced", // Use ``` code blocks (modern standard)
          });

          turndownService.escape = function (string: string) {
            return string;
          };

          const markdown = turndownService.turndown(markdownElement.innerHTML);
          const text = markdown;

          try {
            await copyTextToClipboard(text);
            showCopySuccess(copyButton);
          } catch (err) {
            console.error("Failed to copy text:", err);
            showCopyError(copyButton);
          }
        });

        // Position button based on message type
        if (message.classList.contains("user-message")) {
          // User messages: button on the left (first child)
          message.insertBefore(copyButton, message.firstChild);
        } else {
          // Bot messages: button on the right (last child)
          message.appendChild(copyButton);
        }
      });
    }

    const observer = new MutationObserver(() => {
      addCopyButtons();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    addCopyButtons();
  },
});

// Check if current page is ADK Web
function isADKWeb(): boolean {
  const title = document.title;
  return title.includes("Agent Development Kit") || title.includes("ADK");
}
