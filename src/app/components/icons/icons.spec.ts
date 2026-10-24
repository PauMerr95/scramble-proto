import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Type } from '@angular/core';

import { IconProfile } from '../icons/profile';
import { IconFolder } from '../icons/folder';
import { IconSearchDB } from '../icons/db_search';
import { IconCommand } from './command';
import { IconIdle } from './idle';
import { IconLeader } from './leader';
import { IconSearch } from './search';
import { IconHideSP } from './hide_sidePane';

const ICON_COMPONENTS: Type<unknown>[] = [
    IconProfile,
    IconFolder,
    IconSearchDB,
    IconCommand,
    IconIdle,
    IconLeader,
    IconSearch,
    IconHideSP
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