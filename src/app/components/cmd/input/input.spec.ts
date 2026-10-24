import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CmdInput } from './input';

describe('Input', () => {
  let component: CmdInput;
  let fixture: ComponentFixture<CmdInput>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CmdInput],
    }).compileComponents();

    fixture = TestBed.createComponent(CmdInput);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
