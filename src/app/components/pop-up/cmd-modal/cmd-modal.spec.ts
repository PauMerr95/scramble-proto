import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CmdModal } from './cmd-modal';
import { CmdLineService } from '../../../services/cmd-line-service';

describe('CmdModal', () => {
  let component: CmdModal;
  let fixture: ComponentFixture<CmdModal>;
  let cli: CmdLineService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CmdModal],
    }).compileComponents();

    fixture = TestBed.createComponent(CmdModal);
    component = fixture.componentInstance;
    cli = TestBed.inject(CmdLineService);
    await fixture.whenStable();
  });

  it('should create and stay hidden while closed', () => {
    expect(component).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.cmd-panel')).toBeNull();
  });

  it('should show typed text, sync it into the service and focus the input', async () => {
    cli.open('Command');
    await fixture.whenStable();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('.cmd-input');
    expect(document.activeElement).toBe(input);

    input.value = 'w /data/out.fa';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(cli.cmdInput()).toBe('w /data/out.fa');
    expect(fixture.nativeElement.querySelector('.hint-usage').textContent).toContain('w [path]');
  });

  it('should not render anything for the leader', async () => {
    cli.open('Leader');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.cmd-backdrop')).toBeNull();
  });
});
