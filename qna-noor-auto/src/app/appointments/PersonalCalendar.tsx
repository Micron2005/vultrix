"use client";

import { useState } from "react";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  eachMonthOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { Button, Card, Field, Input, LinkButton, Textarea } from "@/components/ui";
import { SaveButton } from "@/components/SaveButton";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEvent,
} from "./calendar-actions";

export type CalendarEventItem = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  isReminder: boolean;
  notes: string | null;
};

type Props = {
  view: "day" | "week" | "month" | "year";
  date: string;
  events: CalendarEventItem[];
};

const views = ["day", "week", "month", "year"] as const;
const ymd = (date: Date) => format(date, "yyyy-MM-dd");
const eventDate = (event: CalendarEventItem) => new Date(event.startsAt);

export function PersonalCalendar({ view, date, events }: Props) {
  const selectedDate = new Date(`${date}T00:00:00`);
  const [dialog, setDialog] = useState<{ date: string; event?: CalendarEventItem } | null>(null);
  const rangeAnchor = view === "week" ? startOfWeek(selectedDate, { weekStartsOn: 1 }) : selectedDate;
  const previous = view === "day" ? addDays(selectedDate, -1) : view === "week" ? addWeeks(rangeAnchor, -1) : view === "year" ? new Date(selectedDate.getFullYear() - 1, 0, 1) : addMonths(selectedDate, -1);
  const next = view === "day" ? addDays(selectedDate, 1) : view === "week" ? addWeeks(rangeAnchor, 1) : view === "year" ? new Date(selectedDate.getFullYear() + 1, 0, 1) : addMonths(selectedDate, 1);
  const title = view === "year" ? format(selectedDate, "yyyy") : view === "day" ? format(selectedDate, "EEEE, MMMM d, yyyy") : view === "week" ? `${format(rangeAnchor, "MMM d")} – ${format(addDays(rangeAnchor, 6), "MMM d, yyyy")}` : format(selectedDate, "MMMM yyyy");
  const href = (v: string, d: Date) => `/appointments?view=${v}&date=${ymd(d)}`;
  const eventsFor = (day: Date) => events.filter((event) => isSameDay(eventDate(event), day));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-1">
          <LinkButton href={href(view, previous)} variant="secondary" size="sm">← Prev</LinkButton>
          <LinkButton href={href(view, new Date())} variant="ghost" size="sm">Today</LinkButton>
          <LinkButton href={href(view, next)} variant="secondary" size="sm">Next →</LinkButton>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold text-zinc-800">{title}</div>
          <div className="flex rounded-md border border-zinc-300 bg-white p-0.5">
            {views.map((item) => <LinkButton key={item} href={href(item, selectedDate)} variant={item === view ? "primary" : "ghost"} size="sm">{item[0].toUpperCase() + item.slice(1)}</LinkButton>)}
          </div>
          <Button type="button" size="sm" onClick={() => setDialog({ date: date })}>+ Add event</Button>
        </div>
      </div>
      {view === "month" && <MonthView date={selectedDate} eventsFor={eventsFor} onDay={(day) => setDialog({ date: ymd(day) })} onEvent={(event) => setDialog({ date: ymd(eventDate(event)), event })} />}
      {view === "week" && <WeekView date={rangeAnchor} eventsFor={eventsFor} onDay={(day) => setDialog({ date: ymd(day) })} onEvent={(event) => setDialog({ date: ymd(eventDate(event)), event })} />}
      {view === "day" && <DayView date={selectedDate} events={eventsFor(selectedDate)} onAdd={() => setDialog({ date })} onEvent={(event) => setDialog({ date, event })} />}
      {view === "year" && <YearView date={selectedDate} eventsFor={eventsFor} onMonth={(month) => window.location.href = href("month", month)} />}
      {dialog && <EventDialog initialDate={dialog.date} event={dialog.event} onClose={() => setDialog(null)} />}
    </>
  );
}

function EventCard({ event, onClick }: { event: CalendarEventItem; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={"block w-full rounded-md border p-2 text-left text-xs hover:border-zinc-400 " + (event.isReminder ? "border-amber-200 bg-amber-50" : "border-zinc-200 bg-zinc-50")}>
    <div className="font-medium text-zinc-900">{event.isReminder && "🔔 "}{event.title}</div>
    {!event.allDay && <div className="mt-0.5 text-zinc-500">{format(eventDate(event), "h:mm a")}</div>}
  </button>;
}

function MonthView({ date, eventsFor, onDay, onEvent }: { date: Date; eventsFor: (day: Date) => CalendarEventItem[]; onDay: (day: Date) => void; onEvent: (event: CalendarEventItem) => void }) {
  const days = Array.from({ length: 42 }, (_, index) =>
    addDays(startOfWeek(startOfMonth(date), { weekStartsOn: 1 }), index),
  );
  return <Card><div className="grid grid-cols-7 border-b border-zinc-200">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <div key={day} className="p-2 text-center text-xs font-semibold text-zinc-500">{day}</div>)}</div><div className="grid grid-cols-7">{days.map((day) => <DayCell key={ymd(day)} day={day} currentMonth={isSameMonth(day, date)} events={eventsFor(day)} onDay={onDay} onEvent={onEvent} />)}</div></Card>;
}

function DayCell({ day, currentMonth, events, onDay, onEvent }: { day: Date; currentMonth: boolean; events: CalendarEventItem[]; onDay: (day: Date) => void; onEvent: (event: CalendarEventItem) => void }) {
  return <div className={"min-h-28 border-b border-r border-zinc-200 p-2 " + (!currentMonth ? "bg-zinc-50 text-zinc-400" : "")}><button type="button" onClick={() => onDay(day)} className={"mb-1 text-xs font-semibold " + (isToday(day) ? "rounded-full bg-zinc-900 px-1.5 py-0.5 text-white" : "text-zinc-700")}>{format(day, "d")}</button><div className="space-y-1">{events.slice(0, 3).map((event) => <EventCard key={event.id} event={event} onClick={() => onEvent(event)} />)}{events.length > 3 && <div className="text-[11px] text-zinc-500">+{events.length - 3} more</div>}</div></div>;
}

function WeekView({ date, eventsFor, onDay, onEvent }: { date: Date; eventsFor: (day: Date) => CalendarEventItem[]; onDay: (day: Date) => void; onEvent: (event: CalendarEventItem) => void }) {
  const days = Array.from({ length: 7 }, (_, index) => addDays(date, index));
  return <div className="grid grid-cols-1 gap-2 md:grid-cols-7">{days.map((day) => <div key={ymd(day)} className={"min-h-48 rounded-lg border bg-white p-2 " + (isToday(day) ? "border-zinc-900" : "border-zinc-200")}><button type="button" onClick={() => onDay(day)} className="mb-2 text-xs font-semibold text-zinc-700">{format(day, "EEE, MMM d")}</button><div className="space-y-1">{eventsFor(day).map((event) => <EventCard key={event.id} event={event} onClick={() => onEvent(event)} />)}</div></div>)}</div>;
}

function DayView({ date, events, onAdd, onEvent }: { date: Date; events: CalendarEventItem[]; onAdd: () => void; onEvent: (event: CalendarEventItem) => void }) {
  return <Card className="p-4"><div className="mb-3 text-sm font-semibold text-zinc-800">{format(date, "EEEE, MMMM d")}</div>{events.length === 0 ? <button type="button" onClick={onAdd} className="w-full rounded-md border border-dashed border-zinc-300 p-8 text-sm text-zinc-500 hover:bg-zinc-50">No events — add one</button> : <div className="space-y-2">{events.map((event) => <EventCard key={event.id} event={event} onClick={() => onEvent(event)} />)}</div>}</Card>;
}

function YearView({ date, eventsFor, onMonth }: { date: Date; eventsFor: (day: Date) => CalendarEventItem[]; onMonth: (month: Date) => void }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{eachMonthOfInterval({ start: new Date(date.getFullYear(), 0, 1), end: new Date(date.getFullYear(), 11, 1) }).map((month) => <Card key={month.toISOString()} className="p-3"><button type="button" onClick={() => onMonth(month)} className="mb-2 text-sm font-semibold text-zinc-900 hover:underline">{format(month, "MMMM")}</button><div className="grid grid-cols-7 gap-1 text-center text-[10px]">{eachDayOfInterval({ start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }) }).map((day) => <span key={ymd(day)} className={(eventsFor(day).length ? "font-bold text-zinc-900 " : "text-zinc-400 ") + (isToday(day) ? "rounded-full bg-zinc-900 text-white" : "")}>{format(day, "d")}</span>)}</div></Card>)}</div>;
}

function EventDialog({ initialDate, event, onClose }: { initialDate: string; event?: CalendarEventItem; onClose: () => void }) {
  const action = event ? updateCalendarEvent.bind(null, event.id) : createCalendarEvent;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4"><div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">{event ? "Edit event" : "Add event"}</h2><button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-900" aria-label="Close">×</button></div><form action={async (fd) => { await action(fd); onClose(); }} className="space-y-4"><Field label="Title *"><Input name="title" required defaultValue={event?.title ?? ""} autoFocus /></Field><div className="grid grid-cols-2 gap-3"><Field label="Date *"><Input name="date" type="date" required defaultValue={initialDate} /></Field><Field label="Start time"><Input name="startTime" type="time" defaultValue={event && !event.allDay ? format(eventDate(event), "HH:mm") : "09:00"} /></Field><Field label="End time"><Input name="endTime" type="time" defaultValue={event?.endsAt ? format(new Date(event.endsAt), "HH:mm") : ""} /></Field></div><label className="flex items-center gap-2 text-sm text-zinc-700"><input type="checkbox" name="allDay" defaultChecked={event?.allDay} /> All day</label><label className="flex items-center gap-2 text-sm text-zinc-700"><input type="checkbox" name="isReminder" defaultChecked={event?.isReminder} /> Reminder</label><Field label="Notes"><Textarea name="notes" rows={3} defaultValue={event?.notes ?? ""} /></Field><div className="flex justify-between"><div>{event && <button type="button" onClick={async () => { await deleteCalendarEvent(event.id); onClose(); }} className="rounded-md px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50">Delete</button>}</div><div className="flex gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><SaveButton>Save</SaveButton></div></div></form></div></div>;
}
