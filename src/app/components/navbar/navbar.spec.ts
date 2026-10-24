import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IconProfile } from '../icons/profile';
import { IconFolder } from '../icons/folder';
import { IconSearchDB } from '../icons/db_search';
import { Navbar } from './navbar';
import { Component, Input } from '@angular/core';
import { Color } from '../../types/main_types';

@Component({ selector: 'app-icon-profile', template: '', standalone: true}) class MockIconProfile {
  @Input() svg_color: Color = '#FAF0E6';
}
@Component({ selector: 'app-icon-folder', template: '', standalone: true}) class MockIconFolder {
  @Input() svg_color: Color = '#FAF0E6';
}
@Component({ selector: 'app-icon-db-search', template: '', standalone: true}) class MockIconSearchDB {
  @Input() svg_color: Color = '#FAF0E6';
}

describe('Navbar', () => {
  let component: Navbar;
  let fixture: ComponentFixture<Navbar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Navbar],
    }).overrideComponent(Navbar, {
      remove: { imports: [IconProfile, IconFolder, IconSearchDB] },
      add:    { imports: [MockIconProfile, MockIconFolder, MockIconSearchDB] }
    }).compileComponents();

    fixture = TestBed.createComponent(Navbar);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
