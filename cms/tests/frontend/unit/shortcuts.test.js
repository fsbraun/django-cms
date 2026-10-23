'use strict';
import { userEvent } from 'vitest/browser';
import initShortcuts from '../../../static/cms/js/modules/shortcuts';
import initHelpModal from '../../../static/cms/js/modules/shortcuts/help';
import initCreateModal from '../../../static/cms/js/modules/shortcuts/create-modal';
import $ from 'jquery';
import keyboard from '../../../static/cms/js/modules/keyboard';
import Modal from '../../../static/cms/js/modules/cms.modal';
var CMS = window.CMS || {};

CMS.config = CMS.config || {};
CMS.config.lang = CMS.config.lang || {};
var shortcutAreas = [
    {
        title: 'CMS Wide Shortcuts',
        shortcuts: {
            help: {
                shortcut: '?',
                desc: 'Bring up this help dialog'
            },
            esc: {
                shortcut: 'ESC',
                desc: 'Close / cancel'
            },
            'toggle-structure-board': {
                shortcut: 'space',
                desc: 'Toggle structure mode'
            },
            'toggle-structure-board-using-hovered-plugin': {
                shortcut: 'shift+space',
                desc: 'Toggle structure mode and highlight hovered plugin'
            },
            'create-dialog': {
                shortcut: 'alt+c',
                desc: 'Open \u0022Create\u0022 dialog'
            },
            toolbar: {
                shortcut: 'f > t / alt+t'
            }
        }
    },
    {
        title: 'Structure Board',
        shortcuts: {
            placeholders: {
                shortcut: 'f > p',
                desc: 'Focus placeholders'
            },
            traversing: {
                shortcut: 'tab / shift+tab',
                desc: 'Move to next / previous element'
            },
            enter: {
                shortcut: 'enter',
                desc: 'Focus on plugins of placeholder'
            },
            edit: {
                shortcut: 'e',
                desc: 'Edit plugin'
            },
            add: {
                shortcut: '+ / a',
                desc: 'Add plugin'
            },
            settings: {
                shortcut: 's',
                desc: 'Open settings dropdown'
            },
            collapse: {
                shortcut: 'x',
                desc: 'Expand / collapse'
            }
        }
    }
];
CMS.config.lang.shortcutAreas = shortcutAreas;

window.CMS = CMS;

describe('shortcuts', function() {
    fixture.setBase('cms/tests/frontend/unit/fixtures');

    beforeEach(function(done) {
        spyOn(keyboard, 'bind');
        spyOn(keyboard, 'setContext');
        fixture.load('plugins.html');

        $(function() {
            CMS.config.lang.shortcutAreas = shortcutAreas;
            done();
        });
    });

    afterEach(function() {
        fixture.cleanup();
    });

    it('does not explode', function() {
        expect(initShortcuts).not.toThrow();
    });

    describe('help', function() {
        it('binds the shortcut', function() {
            initHelpModal();
            expect(keyboard.setContext).toHaveBeenCalledWith('cms');
            expect(keyboard.bind).toHaveBeenCalledWith('?', jasmine.any(Function), 'global');
        });

        it('shortcut opens modal', function() {
            spyOn(Modal.prototype, 'open');
            initHelpModal();
            keyboard.bind.calls.mostRecent().args[1]({ preventDefault() {} });
            expect(Modal.prototype.open).toHaveBeenCalledTimes(1);
            expect(Modal.prototype.open).toHaveBeenCalledWith({
                width: jasmine.any(Number),
                height: jasmine.any(Number),
                title: CMS.config.lang.shortcuts,
                html: jasmine.any(String)
            });
        });
    });

    describe('toolbar Shortcuts link', function() {
        beforeEach(function() {
            $(fixture.el).append(
                '<div id="shortcut-menu" style="position:fixed;top:100px;left:100px;z-index:1000000">' +
                '<a class="cms-show-shortcuts" href="#">Shortcuts</a></div>'
            );
            // The live toolbar stops clicks before they reach document delegation.
            $('#shortcut-menu').on('click', event => event.stopPropagation());
            spyOn(Modal.prototype, 'open');
            initHelpModal();
        });

        afterEach(async function() {
            await userEvent.cleanup();
        });

        it('opens once when Enter activates the link', async function() {
            document.querySelector('#shortcut-menu a').focus();
            await userEvent.keyboard('{Enter}');
            expect(Modal.prototype.open).toHaveBeenCalledTimes(1);
        });

        it('closes the toolbar menu when opening the dialog', async function() {
            const reset = vi.fn();

            $(document).one('click.cms.toolbar', reset);
            document.querySelector('#shortcut-menu a').focus();
            await userEvent.keyboard('{Enter}');
            expect(reset).toHaveBeenCalledTimes(1);
        });

        it('opens once for a pointer click', async function() {
            await userEvent.click(document.querySelector('#shortcut-menu a'));
            expect(Modal.prototype.open).toHaveBeenCalledTimes(1);
        });

        it('handles refreshed toolbar markup without adding duplicate listeners', async function() {
            initHelpModal();
            $('#shortcut-menu').html('<a class="cms-show-shortcuts" href="#">Shortcuts</a>');
            document.querySelector('#shortcut-menu a').focus();
            await userEvent.keyboard('{Enter}');
            expect(Modal.prototype.open).toHaveBeenCalledTimes(1);
        });
    });

    describe('create-modal', function() {
        it('binds the shortcut', function() {
            initCreateModal();
            expect(keyboard.setContext).toHaveBeenCalledWith('cms');
            expect(keyboard.bind).toHaveBeenCalledWith('alt+c', jasmine.any(Function));
        });

        it('shortcut triggers click on create button', function(done) {
            $(fixture.el).append('<div class="cms-btn" href="wizard"></div>');
            initCreateModal();
            $('.cms-btn').on('click', function() {
                done();
            });
            keyboard.bind.calls.mostRecent().args[1]();
        });
    });
});
