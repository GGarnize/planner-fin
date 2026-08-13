package com.plannerfin.app;

final class PlannerFinNotificationEvent {
    final String packageName;
    final String key;
    final long postTime;
    final String title;
    final String text;
    final String subText;
    final String bigText;

    PlannerFinNotificationEvent(
            String packageName,
            String key,
            long postTime,
            String title,
            String text,
            String subText,
            String bigText) {
        this.packageName = packageName;
        this.key = key;
        this.postTime = postTime;
        this.title = title;
        this.text = text;
        this.subText = subText;
        this.bigText = bigText;
    }
}
