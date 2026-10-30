import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Type } from '@angular/core';

import { IconSettings } from './icon-settings';
import { IconScrambleSettings } from './icon-scramble-settings';
import { IconAppearanceSettings } from './icon-appearance-settings';
import { IconNcbiSettings } from './icon-ncbi-settings';
import { IconFolder } from '../icons/folder';
import { IconSearchDB } from '../icons/db_search';
import { IconCommand } from './command';
import { IconSearch } from './search';

const ICON_COMPONENTS: Type<unknown>[] = [
    IconSettings,
    IconScrambleSettings,
    IconAppearanceSettings,
    IconNcbiSettings,
    IconFolder,
    IconSearchDB,
    IconCommand,
    IconSearch
];

describe('Icon component', () => {
    for (const IconComponent of ICON_COMPONENTS) {
        describe(IconComponent.name, () => {
            let fixture: ComponentFixture<unknown>;

            beforeEach(async () => {
                await TestBed.configureTestingModule({
                imports: [IconComponent],
                }).compileComponents();
            
                fixture = TestBed.createComponent(IconComponent);
                fixture.detectChanges();
            });

            it('renders without errors', () => {
                expect(fixture.nativeElement.querySelector('svg')).toBeTruthy();
            });
            it('produces non-empty HTML', () => {
                expect(fixture.nativeElement.innerHTML.trim()).not.toBe('');
            });
        });
    }
});