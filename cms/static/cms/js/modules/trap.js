// Copyright (c) 2011, 2012 Julien Wajsberg, 2025 Fabian Braun

const DATA_ISTRAPPING_KEY = '__trap_isTrapping';
const boundaries = new WeakMap();
const frameLoadListeners = new WeakMap();
const focusableSelector = 'a[href], button, input, textarea, select, iframe, [tabindex], [contenteditable], summary';

function frameDocument(frame) {
    try {
        return frame.contentDocument;
    } catch {
        return null;
    }
}

function isFocusable(element) {
    const style = element.ownerDocument.defaultView.getComputedStyle(element);
    const editable = element.isContentEditable && !element.hasAttribute('tabindex');

    return (element.tabIndex >= 0 || editable) && element.getClientRects().length > 0 &&
        style.visibility !== 'hidden' && style.visibility !== 'collapse' &&
        !element.matches(':disabled') &&
        !element.closest('[inert], [hidden], [aria-disabled="true"], .cms-btn-disabled');
}

/** Return the tab sequence, with each same-origin iframe's controls at its position. */
function getFocusableElementsInContainer(container) {
    const elements = Array.from(container.querySelectorAll(focusableSelector)).filter(isFocusable);
    const tabbable = elements.filter(element => {
        if (!element.matches('input[type="radio"][name]') || !element.name) {
            return true;
        }
        const group = elements.filter(other => other.matches('input[type="radio"]') &&
            other.name === element.name && other.form === element.form);

        return element === (group.find(radio => radio.checked) || group[0]);
    });

    // Positive tab indices precede the normal DOM order. Sorting is stable.
    tabbable.sort((a, b) => (a.tabIndex > 0 ? a.tabIndex : Infinity) -
        (b.tabIndex > 0 ? b.tabIndex : Infinity));
    return tabbable.flatMap(element => {
        if (element.tagName !== 'IFRAME') {
            return [element];
        }
        const body = frameDocument(element)?.body;
        const contents = body ? getFocusableElementsInContainer(body) : [];

        return contents.length ? contents : [element];
    });
}

function focusIndex(elements, event, boundary) {
    const target = event.target;
    const index = elements.indexOf(target);

    if (index >= 0 || target.ownerDocument === boundary.ownerDocument) {
        return index;
    }
    // An iframe may initially focus its body before its first form field.
    const firstInFrame = elements.findIndex(element => element.ownerDocument === target.ownerDocument);

    if (firstInFrame >= 0) {
        return firstInFrame - (event.shiftKey ? 0 : 1);
    }
    return elements.indexOf(target.ownerDocument.defaultView.frameElement);
}

function moveFocus(event, boundary) {
    const elements = getFocusableElementsInContainer(boundary);
    const index = focusIndex(elements, event, boundary);
    let next = index + (event.shiftKey ? -1 : 1);

    if (index < 0) {
        next = event.shiftKey ? elements.length - 1 : 0;
    }
    event.preventDefault();
    if (elements.length) {
        elements[(next + elements.length) % elements.length].focus();
    } else {
        boundary.focus();
    }
}

function onKeyPress(event) {
    if (event.key !== 'Tab' || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
        return;
    }
    const boundary = boundaries.get(event.currentTarget);

    // Forwarded iframe events must respect minimizing or closing the dialog.
    if (!boundary?.[DATA_ISTRAPPING_KEY]) {
        return;
    }
    moveFocus(event, boundary);
}

/**
 * Cycle Tab and Shift+Tab inside a focus boundary, including same-origin iframes.
 * @param {HTMLElement} element element receiving keyboard events
 * @param {HTMLElement} [boundary=element] enclosing focus boundary
 */
export function trap(element, boundary = element) {
    if (!element) {
        return;
    }
    element.addEventListener('keydown', onKeyPress);
    boundaries.set(element, boundary);
    element[DATA_ISTRAPPING_KEY] = true;

    element.removeEventListener('load', frameLoadListeners.get(element), true);
    const onFrameLoad = event => {
        if (event.target.tagName === 'IFRAME' && boundary[DATA_ISTRAPPING_KEY]) {
            trap(frameDocument(event.target)?.body, boundary);
        }
    };

    frameLoadListeners.set(element, onFrameLoad);
    element.addEventListener('load', onFrameLoad, true);
    // Also cover frames that loaded before the boundary was activated.
    for (const frame of element.querySelectorAll('iframe')) {
        trap(frameDocument(frame)?.body, boundary);
    }
}

/** Release a focus trap. Forwarded iframe events become inactive with their boundary. */
export function untrap(element) {
    if (!element) {
        return;
    }
    element.removeEventListener('keydown', onKeyPress);
    element.removeEventListener('load', frameLoadListeners.get(element), true);
    frameLoadListeners.delete(element);
    boundaries.delete(element);
    delete element[DATA_ISTRAPPING_KEY];
}

/** Whether the element currently owns a focus trap. */
export function isTrapping(element) {
    return !!(element && element[DATA_ISTRAPPING_KEY]);
}
