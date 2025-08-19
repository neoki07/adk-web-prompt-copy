export default defineContentScript({
  matches: ["<all_urls>"],
  main() {
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

    function addCopyButtons() {
      const userMessages = document.querySelectorAll(".user-message");

      userMessages.forEach((userMessage) => {
        // Check if copy button already exists
        if (userMessage.querySelector(".copy-prompt-button")) return;

        const markdownElement = userMessage.querySelector("markdown");
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
          tooltip = createTooltip(copyButton, "テキストをコピー");
        });

        copyButton.addEventListener("mouseleave", removeTooltip);

        // Also remove tooltip when scrolling or clicking elsewhere
        copyButton.addEventListener("blur", removeTooltip);
        document.addEventListener("scroll", removeTooltip, { passive: true });

        copyButton.addEventListener("click", async () => {
          removeTooltip();

          if (!markdownElement) return;

          const text = markdownElement.textContent?.trim() || "";

          try {
            await navigator.clipboard.writeText(text);
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
          } catch (err) {
            console.error("Failed to copy text:", err);
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
        });

        // Insert the button as the first child of user-message
        userMessage.insertBefore(copyButton, userMessage.firstChild);
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
