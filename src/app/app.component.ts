import {Component, OnDestroy, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {MomentDateAdapter, MAT_MOMENT_DATE_ADAPTER_OPTIONS} from '@angular/material-moment-adapter';
import {DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE} from '@angular/material/core';
import {MatDialog} from '@angular/material/dialog';
import {MatIconRegistry} from "@angular/material/icon";
import {DomSanitizer} from "@angular/platform-browser";
import {Subscription} from "rxjs";
import * as _moment from 'moment';
// @ts-ignore
import {default as _rollupMoment} from 'moment';

import {DialogComponent} from './components/dialog/dialog.component';

const moment = _rollupMoment || _moment;

const MY_FORMATS = {
  parse: {
    dateInput: 'DD/MM/YYYY',
  },
  display: {
    dateInput: 'DD/MM/YYYY',
    monthYearLabel: 'YYYY',
    dateA11yLabel: 'LL',
    monthYearA11yLabel: 'YYYY',
  },
};

function getTimeRanges(interval = 15, language = 'ru') {
  const ranges = [];
  const date = new Date();
  const options: Intl.DateTimeFormatOptions = {hour: 'numeric', minute: "numeric"};

  for (let minutes = 0; minutes < 24 * 60; minutes = minutes + 15) {
    date.setHours(0);
    date.setMinutes(minutes);
    ranges.push(date.toLocaleTimeString(language, options).toString());
  }

  return ranges;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  providers: [
    {
      provide: DateAdapter,
      useClass: MomentDateAdapter,
      deps: [MAT_DATE_LOCALE, MAT_MOMENT_DATE_ADAPTER_OPTIONS],
    },

    {provide: MAT_DATE_FORMATS, useValue: MY_FORMATS},
  ],
})
export class AppComponent implements OnInit, OnDestroy {
  dateForm: FormGroup = this.fb.group({
    startDate: [moment().startOf('day'), Validators.required],
    endDate: [moment().startOf('day'), Validators.required],
    startTime: ['00:00', Validators.required],
    endTime: ['00:00', Validators.required],
  });
  times = getTimeRanges(15, 'ru');
  subscriptionStartDate!: Subscription;
  subscriptionStartTime!: Subscription;
  subscriptionEndDate!: Subscription;
  subscriptionEndTime!: Subscription;


  constructor(
    public dialog: MatDialog,
    private matIconRegistry: MatIconRegistry,
    private domSanitizer: DomSanitizer,
    private fb: FormBuilder
  ) {
    this.matIconRegistry.addSvgIcon(
      "searchIcon",
      this.domSanitizer.bypassSecurityTrustResourceUrl("../assets/search.svg")
    );
  }

  ngOnInit() {
    const currentMoment = moment();
    const cloneCurrentMoment = currentMoment.clone();
    const currentDate = `${moment().hours()}:${moment().minutes()}`;
    const [currentHours, currentMinutes] = currentDate.split(':');
    const startTime = this.countStartTime(currentHours, currentMinutes);
    this.dateForm.controls['startTime'].setValue(startTime);
    if (+currentHours < 23) {
      const endTime = this.appendOneHour(startTime);
      this.dateForm.controls['endTime'].setValue(endTime);
    } else {
      const tomorrow = cloneCurrentMoment.add(1, 'days');
      const startTimeMinutes = startTime.split(':')[1];
      const endTime = `00:${startTimeMinutes}`;
      this.dateForm.controls['endDate'].setValue(tomorrow);
      this.dateForm.controls['endTime'].setValue(endTime);
    }

    this.subscriptionStartDate = this.dateForm.controls['startDate'].valueChanges.subscribe(change => {
      this.dateForm.controls['endDate'].setValue(change);
    })
    this.subscriptionStartTime = this.dateForm.controls['startTime'].valueChanges.subscribe(change => {
      const [changeHours, changeMinutes] = change.split(':');
      if (+changeHours < 23) {
        const endTime = this.appendOneHour(change);
        this.dateForm.controls['endTime'].setValue(endTime);
      } else {
        const startDateValue = this.dateForm.controls['startDate'].value;
        const tomorrow = startDateValue.clone().add(1, 'days');
        const startTimeMinutes = change.split(':')[1];
        const endTime = `00:${startTimeMinutes}`;
        this.dateForm.controls['endDate'].setValue(tomorrow);
        this.dateForm.controls['endTime'].setValue(endTime);
      }
    })

    this.subscriptionEndDate = this.dateForm.controls['endDate'].valueChanges.subscribe(change => {
      const startDateValue = this.dateForm.controls['startDate'].value;
      const startTimeValue = this.dateForm.controls['startTime'].value;
      const endDateValue = change;
      const endTimeValue = this.dateForm.controls['endTime'].value;
      const diff = this.getDiffDates(startDateValue, startTimeValue, endDateValue, endTimeValue);
      if (diff > 1 || diff < 0) {
        this.dateForm.controls['endDate'].setErrors({'incorrect': true});
      }

    })

    this.subscriptionEndTime = this.dateForm.controls['endTime'].valueChanges.subscribe(change => {
      const startDateValue = this.dateForm.controls['startDate'].value;
      const startTimeValue = this.dateForm.controls['startTime'].value;
      const endDateValue = this.dateForm.controls['endDate'].value;
      const endTimeValue = change;
      const diff = this.getDiffDates(startDateValue, startTimeValue, endDateValue, endTimeValue);
      if (diff > 1 || diff < 0) {
        this.dateForm.controls['endTime'].setErrors({'incorrect': true});
      } else {
        this.dateForm.controls['endDate'].setErrors(null);

      }

    })

  }

  ngOnDestroy() {
    this.subscriptionStartDate.unsubscribe();
    this.subscriptionStartTime.unsubscribe();
    this.subscriptionEndDate.unsubscribe();
    this.subscriptionEndTime.unsubscribe();
  }

  openDialog(): void {
    const startDateValue = this.dateForm.controls['startDate'].value.clone();
    const [startHours, startMinutes] = this.dateForm.controls['startTime'].value.split(':');
    const endDateValue = this.dateForm.controls['endDate'].value.clone();
    const [endHours, endMinutes] = this.dateForm.controls['endTime'].value.split(':');
    const formattedStartDateValue = this.addFormatHoursAndMinutes(startDateValue, startHours, startMinutes)
    const formattedEndDateValue = this.addFormatHoursAndMinutes(endDateValue, endHours, endMinutes)
    const start = formattedStartDateValue.utcOffset(0, true).format();
    const end = formattedEndDateValue.utcOffset(0, true).format();
    this.dialog.open(DialogComponent, {
      panelClass: 'my-dialog',
      data: {
        start,
        end,
      },
    });
  }

  private countStartTime(currentHours = '0', currentMinutes = '0') {
    currentHours = currentHours.padStart(2, '0');
    if (+currentMinutes < 0 || +currentMinutes > 59) throw Error('invalid currentMinutes')
    if (+currentMinutes < 15) {
      return `${currentHours}:00`
    } else if (+currentMinutes < 30) {
      return `${currentHours}:15`
    } else if (+currentMinutes < 45) {
      return `${currentHours}:30`
    } else {
      return `${currentHours}:45`
    }
  }

  private appendOneHour(date = '') {
    const [hours, minutes] = date.split(':');
    if (+hours > 23) throw Error('invalid date')
    return `${(+hours + 1).toString().padStart(2, '0')}:${minutes}`
  }

  private getDiffDates(startDate: _moment.Moment, startTime = '', endDate: _moment.Moment, endTime = '') {
    const cloneStartDate = startDate.clone();
    const cloneEndDate = endDate.clone();
    const [startHours, startMinutes] = startTime.split(':');
    const [endHours, endMinutes] = endTime.split(':');
    const formattedCloneStartDate = this.addFormatHoursAndMinutes(cloneStartDate, startHours, startMinutes)
    const formattedCloneEndDate = this.addFormatHoursAndMinutes(cloneEndDate, endHours, endMinutes)
    return formattedCloneEndDate.diff(formattedCloneStartDate, 'hours', true);
  }

  private addFormatHoursAndMinutes(date: _moment.Moment, hours = '', minutes = '') {
    date.add(+hours, 'h')
    date.add(+minutes, 'minutes')
    return date
  }

  getErrorMessage(name = ''): string {
    switch (name) {
      case 'endDate':
        return 'Invalid date'
      case 'endTime':
        return 'Invalid time'
      default :
        return 'Error'
    }
  }
}
