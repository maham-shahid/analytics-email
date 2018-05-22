# analytics-email-app

The project contains

* [Main code file for the app](https://github.com/maham-shahid/analytics-email/blob/master/index.js)
* Stat files, containing some sample usage data (named by date such as [2018-5-22](https://github.com/maham-shahid/analytics-email/blob/master/2018-5-22.json), which is the usage stats from emails tested out on 22nd May)
* Package file for dependencies
* File containing some [sample JQL scripts](https://github.com/maham-shahid/analytics-email/blob/master/test-jql-query.js) (for testing and learning purposes)


## Pre-Reqs

* Needs API-KEY from SendGrid
* To actually implement the emails, a subscription will have to be bought from SendGrid


## Main Functionality

The app works in the following way:

* The route `/webhook-data` is exposed as a webhook URL and will receive data from Mixpanel (a webhook campaign will first have to be created in Mixpanel and this URL will be receiving the data from it: data will be of users who have performed any of `DocsViewed`, `SDKGeneratedAPI`, `SDKGeneratedWebsite`, `TransformViaAPI`, `TransformViaWebsite` events within the last 7 days)
* The route calls `processWebhook` function, which parses the data and stores all the emails received from mixpanel, into an array
* The next part is processing data, this is scheduled to take place on Friday of every week. The block of code contained within `schedule.scheduleJob` is called when the selected day and time matches.
* In this case, data for number of transformations, and number of SDKs generated + Docs Viewed will then be retrieved for all the emails that were stored in the array.
* Based on this data, html email template is merged with the data for each email.
* SendGrid SDK is used to call their API and send forward the emails.