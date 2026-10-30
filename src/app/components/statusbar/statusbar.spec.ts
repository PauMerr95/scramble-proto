import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Statusbar } from './statusbar';
import { CmdLineService } from '../../services/cmd-line-service';
import { PaneService } from '../../services/pane-service';

describe('Statusbar', () => {
  let component: Statusbar;
  let fixture: ComponentFixture<Statusbar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Statusbar],
    }).compileComponents();

    fixture = TestBed.createComponent(Statusbar);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show the leader badge only while the leader waits for a key', async () => {
    const cli = TestBed.inject(CmdLineService);
    expect(fixture.nativeElement.querySelector('.leader-badge')).toBeNull();
    cli.open('Leader');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.leader-badge')).toBeTruthy();
    cli.close();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.leader-badge')).toBeNull();
  });

  it('should show the number of the active pane', async () => {
    const badge = () => fixture.nativeElement.querySelector('.pane-badge')?.textContent?.trim();
    expect(badge()).toBe('1');
    TestBed.inject(PaneService).split('Horizontal');
    await fixture.whenStable();
    expect(badge()).toBe('3');
  });
});
