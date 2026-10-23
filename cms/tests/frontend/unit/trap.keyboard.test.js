import { userEvent } from 'vitest/browser';
import { trap, untrap } from '../../../static/cms/js/modules/trap';

const focused = element => expect(element.ownerDocument.activeElement).toBe(element);

async function setup(withFrame = true) {
    fixture.set(`
        <button id="outside">Outside</button>
        <div id="dialog" role="dialog" tabindex="-1">
            <header><button id="minimize">Minimize</button><button id="maximize">Maximize</button>
                <button id="close">Close</button></header>
            ${withFrame ? '<iframe title="Edit form"></iframe>' : '<div id="fields"></div>'}
            <footer><a href="#" id="save">Save</a><a href="#" id="cancel">Cancel</a></footer>
        </div>`);
    const dialog = document.getElementById('dialog');
    const frame = dialog.querySelector('iframe');
    const fields = frame ? frame.contentDocument.body : document.getElementById('fields');
    fields.innerHTML = '<input id="first" aria-label="Title"><textarea id="last" aria-label="Description"></textarea>';
    const first = fields.querySelector('#first');
    const last = fields.querySelector('#last');
    const save = document.getElementById('save');
    const cancel = document.getElementById('cancel');
    const minimize = document.getElementById('minimize');
    const maximize = document.getElementById('maximize');
    const close = document.getElementById('close');
    trap(dialog);
    return { dialog, frame, fields, first, last, save, cancel, minimize, maximize, close };
}

describe('complete dialog Tab cycle', () => {
    afterEach(async () => {
        untrap(document.getElementById('dialog'));
        await userEvent.cleanup();
        fixture.cleanup();
    });

    for (const withFrame of [true, false]) {
        const mode = withFrame ? 'iframe' : 'inline';
        it(`cycles through header, ${mode} fields and footer in both directions`, async () => {
            const { dialog, first, last, save, cancel, minimize, maximize, close } = await setup(withFrame);
            dialog.focus();
            const order = [minimize, maximize, close, first, last, save, cancel];
            for (const element of order.concat(order)) {
                await userEvent.tab();
                focused(element);
            }
            for (const element of order.slice(0, -1).reverse().concat(cancel)) {
                await userEvent.tab({ shift: true });
                focused(element);
            }
        });
    }

    it('skips hidden and disabled controls, including disabled fieldsets and footer links', async () => {
        const { fields, last, save, cancel, minimize, maximize, close } = await setup();
        fields.insertAdjacentHTML('beforeend', '<fieldset disabled><input aria-label="Unavailable"></fieldset>');
        maximize.hidden = true;
        save.setAttribute('aria-disabled', 'true');
        last.focus();
        await userEvent.tab();
        focused(cancel);
        await userEvent.tab();
        focused(minimize);
        await userEvent.tab();
        focused(close);
    });

    it('picks up new footer actions without rebuilding the trap', async () => {
        const { save, cancel } = await setup();
        cancel.insertAdjacentHTML('beforebegin', '<button id="extra">Save and continue</button>');
        save.focus();
        await userEvent.tab();
        focused(document.getElementById('extra'));
        await userEvent.tab();
        focused(cancel);
    });

    it('keeps iframe events connected after navigation', async () => {
        const { frame, save, close } = await setup();
        const loaded = new Promise(resolve => frame.addEventListener('load', resolve, { once: true }));
        frame.srcdoc = '<input id="replacement" aria-label="Replacement">';
        await loaded;
        const input = frame.contentDocument.getElementById('replacement');
        input.focus();
        await userEvent.tab();
        focused(save);
        await userEvent.tab({ shift: true });
        focused(input);
        await userEvent.tab({ shift: true });
        focused(close);
    });

    it('includes dynamically loaded nested frames in the same cycle', async () => {
        const { fields, first, last } = await setup();
        const nested = document.createElement('iframe');
        const loaded = new Promise(resolve => nested.addEventListener('load', resolve, { once: true }));
        nested.srcdoc = '<input id="nested" aria-label="Nested editor">';
        fields.insertBefore(nested, last);
        await loaded;
        const input = nested.contentDocument.getElementById('nested');
        first.focus();
        await userEvent.tab();
        focused(input);
        await userEvent.tab();
        focused(last);
        await userEvent.tab({ shift: true });
        focused(input);
        await userEvent.tab({ shift: true });
        focused(first);
    });

    it('honors positive tab indices and radio groups', async () => {
        const { dialog } = await setup(false);
        dialog.innerHTML = `<a href="#" id="normal">Normal</a>
            <button tabindex="2" id="second">Second</button><button tabindex="1" id="priority">First</button>
            <input type="radio" name="choice" id="unchecked"><input type="radio" name="choice" id="checked" checked>
            <div contenteditable="true" id="editor">Text</div>`;
        dialog.focus();
        for (const id of ['priority', 'second', 'normal', 'checked', 'editor', 'priority']) {
            await userEvent.tab();
            focused(document.getElementById(id));
        }
    });

    it('leaves iframe Tab events alone after the modal is untrapped', async () => {
        const { dialog, first } = await setup();
        untrap(dialog);
        first.focus();
        const event = new first.ownerDocument.defaultView.KeyboardEvent('keydown', {
            key: 'Tab', bubbles: true, cancelable: true
        });
        first.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(false);
    });
});
