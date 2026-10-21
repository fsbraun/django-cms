/* global django, gettext */
(function($) {
    $(function() {
        // INFO: it is not possible to put a form inside a form, so
        // the actions have to create their own form on click.
        // Note for any apps inheriting the burger menu, this will also capture those events.

        function closeSideFrame() {
            try {
                window.top.CMS.API.Sideframe.close();
            } catch {}
        }
        $(`.js-action,
           .cms-js-edit-btn,
           .cms-actions-dropdown-menu-item-anchor`)
            .on('click', function(e) {
                let action = $(e.currentTarget);

                if (action.is('.inactive, [aria-disabled="true"]') || !action.attr('href')) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    return;
                }
                let formMethod = action.hasClass('cms-form-post-method') ? 'POST' : 'GET';
                let keepSideFrame = action.attr('class').indexOf('js-keep-sideframe') !== -1;

                if (formMethod === 'GET') {
                    if (!keepSideFrame) {
                        action.attr('target', '_top');
                        closeSideFrame();
                    }
                } else {
                    e.preventDefault();
                    let body = window.top.document.body;

                    if (keepSideFrame) {
                        body = window.document.body;
                    }

                    /* Get csrftoken either from form (admin) or from the toolbar */
                    let formToken = document.querySelector('form input[name="csrfmiddlewaretoken"]');
                    /* Build the form through the DOM API: the href and the token must never be
                       interpolated into an HTML string, since jQuery hands back the *decoded*
                       attribute value and a quote in it would break out of the attribute. */
                    let doc = body.ownerDocument;
                    let fakeForm = doc.createElement('form');
                    let tokenInput = doc.createElement('input');

                    fakeForm.style.display = 'none';
                    fakeForm.setAttribute('method', formMethod);
                    fakeForm.setAttribute('action', action.attr('href'));

                    tokenInput.setAttribute('type', 'hidden');
                    tokenInput.setAttribute('name', 'csrfmiddlewaretoken');
                    tokenInput.value = (formToken ? formToken.value : formToken) || window.CMS.config.csrf;
                    fakeForm.appendChild(tokenInput);

                    if (!keepSideFrame) {
                        closeSideFrame();
                    }
                    $(fakeForm).appendTo(body).submit();
                }
            });

        // Links handle Enter natively. POST actions also expose button semantics
        // and need Space activation, including after being moved into a menu.
        $('.js-action, .cms-js-edit-btn, .cms-actions-dropdown-menu-item-anchor').on('keydown', function(e) {
            if (e.key === ' ' && this.matches('[role="button"], [role="menuitem"]')) {
                e.preventDefault();
                this.click();
            }
        });

        $('.js-close-sideframe').on('click', function () {
            if ($(this).is('.inactive, [aria-disabled="true"]')) {
                return;
            }
            try {
                window.top.CMS.API.Sideframe.close();
            } catch {}
        });
    });

    // Hide django messages after timeout occurs to prevent content overlap
    $('document').ready(function() {
        // Targeting first item returned (there's only ever one messagelist per template):
        const fadeInterval = 20;
        const messageDelay = 5000;
        let messageList = document.getElementsByClassName('messagelist')[0];

        if (messageList !== undefined) {
            for (let item of messageList.children) {
                item.style.opacity = 1;
                setTimeout(() => {
                    let fader = setInterval(() => {
                        item.style.opacity -= 0.05;
                        if (item.style.opacity < 0) {
                            item.style.display = 'none';
                            clearInterval(fader);
                        }
                    }, fadeInterval);
                }, messageDelay);
            }
        }
    });

    // Create a keyboard-accessible menu while preserving the original actions
    // and their event handlers, HTTP methods, disabled state and sideframe flags.
    $(function() {
        const menus = [];
        const actionsLabel = typeof gettext === 'function' ? gettext('Actions') : 'Actions';
        const closeBurgerMenu = function() {
            menus.forEach(({ anchor, optionsContainer }) => {
                anchor.classList.remove('open');
                anchor.classList.add('closed');
                anchor.setAttribute('aria-expanded', 'false');
                optionsContainer.classList.remove('open');
                optionsContainer.classList.add('closed');
            });
        };

        $('#result_list').find('tr').each(function(index, row) {
            const actions = $(row).children('.field-list_actions')[0];

            if (!actions || !actions.querySelector('.cms-burger-action-btn')) {
                return;
            }
            const anchor = document.createElement('button');
            const icon = document.createElement('span');
            const optionsContainer = document.createElement('div');
            const ul = document.createElement('ul');
            const menuId = 'cms-actions-menu-' + index;

            anchor.type = 'button';
            anchor.id = menuId + '-toggle';
            anchor.className = 'btn cms-action-btn cms-burger-menu closed';
            anchor.title = actionsLabel;
            anchor.setAttribute('aria-label', actionsLabel);
            anchor.setAttribute('aria-expanded', 'false');
            anchor.setAttribute('aria-haspopup', 'menu');
            anchor.setAttribute('aria-controls', menuId);
            icon.className = 'cms-icon cms-icon-menu';
            icon.setAttribute('aria-hidden', 'true');
            anchor.appendChild(icon);

            optionsContainer.id = menuId;
            optionsContainer.className =
                'cms-actions-dropdown-menu cms-actions-dropdown-menu-arrow-right-top closed';
            optionsContainer.setAttribute('role', 'menu');
            optionsContainer.setAttribute('aria-labelledby', anchor.id);
            optionsContainer.tabIndex = -1;
            ul.className = 'cms-actions-dropdown-menu-inner';
            ul.setAttribute('role', 'presentation');

            $(actions).children('.cms-burger-action-btn').each(function(itemIndex, item) {
                const li = document.createElement('li');
                const label = document.createElement('span');

                li.setAttribute('role', 'presentation');
                item.classList.remove('btn', 'cms-action-btn', 'cms-burger-action-btn');
                item.classList.add('cms-actions-dropdown-menu-item-anchor');
                item.setAttribute('role', 'menuitem');
                item.tabIndex = -1;
                label.className = 'label';
                label.textContent = item.title;
                item.appendChild(label);
                li.appendChild(item);
                ul.appendChild(li);
            });
            optionsContainer.appendChild(ul);
            actions.appendChild(anchor);
            document.body.appendChild(optionsContainer);
            menus.push({ anchor, optionsContainer });

            const enabledItems = () => Array.from(optionsContainer.querySelectorAll('[role="menuitem"]'))
                .filter(item => !item.matches('.inactive, [aria-disabled="true"]'));
            const openMenu = function(last = false) {
                closeBurgerMenu();
                anchor.classList.replace('closed', 'open');
                anchor.setAttribute('aria-expanded', 'true');
                optionsContainer.classList.replace('closed', 'open');
                const menuOffset = 5;
                const pos = $(anchor).offset();
                const items = enabledItems();
                const item = last ? items[items.length - 1] : items[0];

                $(optionsContainer).css({
                    left: pos.left - $(optionsContainer).width() - menuOffset,
                    top: pos.top - 2
                });
                (item || optionsContainer).focus();
            };

            anchor.addEventListener('click', function(event) {
                event.stopPropagation();
                if (anchor.getAttribute('aria-expanded') === 'true') {
                    closeBurgerMenu();
                } else {
                    openMenu();
                }
            });
            anchor.addEventListener('keydown', function(event) {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault();
                    openMenu(event.key === 'ArrowUp');
                } else if (event.key === 'Escape') {
                    event.preventDefault();
                    closeBurgerMenu();
                }
            });
            optionsContainer.addEventListener('keydown', function(event) {
                if (event.key === 'Escape' || event.key === 'Tab') {
                    if (event.key === 'Escape') {
                        event.preventDefault();
                        event.stopPropagation();
                    }
                    closeBurgerMenu();
                    // Let Tab continue from the trigger's position in the table.
                    anchor.focus();
                } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
                    event.preventDefault();
                    const items = enabledItems();
                    const current = items.indexOf(document.activeElement);
                    let next = 0;

                    if (event.key === 'End') {
                        next = items.length - 1;
                    } else if (event.key !== 'Home') {
                        next = (current + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length;
                    }
                    items[next]?.focus();
                }
            });
            optionsContainer.addEventListener('focusout', function(event) {
                if (!optionsContainer.contains(event.relatedTarget) && event.relatedTarget !== anchor) {
                    closeBurgerMenu();
                }
            });
        });

        $(window).on('click', closeBurgerMenu);
    });

})((typeof django !== 'undefined' && django.jQuery) || (typeof CMS !== 'undefined' && CMS.$) || false);
