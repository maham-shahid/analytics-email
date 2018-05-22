'use strict';

const express = require('express');
const request = require('request');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const schedule = require('node-schedule');
const sgMail = require('@sendgrid/mail');
const app = express();

const emailsArray = [];
let dictEmailBody = [];

// TODO: api key not safe, fix and embed in environment
sgMail.setApiKey('apikey');
// console.log(process.env.SENDGRID_API_KEY);

const rule = new schedule.RecurrenceRule();
rule.dayOfWeek = 2;
rule.hour = 13;
rule.minute = 3;
// TODO: set it for Friday, at 4:00 PM
// rule.dayOfWeek = 5; rule.hour = 16; rule.minute = 0
 
const job = schedule.scheduleJob(rule, () => {
	console.log('The empire\'s time has come!');
	dictEmailBody = [];

	// emailsArray.push('email address to check, for debugging purposes');

	emailsArray.forEach((email, index) => {
		const jqlSdkDocsQuery = `function main() { return join(Events({from_date: "${getFormattedDate(new Date(), true)}",to_date: "${getFormattedDate(new Date())}",event_selectors: [{"event":"DocsViewed"},{"event": "SDKGenerated_API"},{"event": "SDKGenerated_WEBSITE"}]}),People()).filter(function(tuple) {return tuple.event && tuple.event.properties.$username == "${email}";});}`;
		const jqlTransformerQuery = `function main() { return join(Events({from_date: "${getFormattedDate(new Date(), true)}",to_date: "${getFormattedDate(new Date())}",event_selectors: [{"event": "TransformViaWeb"},{"event": "TransformViaAPI"}]}),People()).filter(function(tuple) {return tuple.event && tuple.user && tuple.user.properties.$email == "${email}";}).reduce(mixpanel.reducer.count());}`;
		runTranformerQuery(jqlTransformerQuery, jqlSdkDocsQuery, email, index);
	});

	// TODO: this is a temporary work around, needs to be fixed
	setTimeout(() => {
		sendEmails();
	}, 10000);

});

const getAuthHeader = () => {
	const un = 'username';
	const pwd = '';
	const creds = `${un}:${pwd}`;
	return `Basic ${Buffer.from(creds).toString('base64')}`
};

const runTranformerQuery = (query, sdkQuery, emailId, index) => {
	console.log('running transformer query');
	let emailData = {
		email: emailId,
		transformations: 0,
		sdksGenerated: false,
		sdks: {
			node: 0,
			angular: 0,
			csharp: 0,
			android: 0,
			java: 0,
			php: 0,
			python: 0,
			ruby: 0,
			go: 0,
			objectivec: 0
		},
		docsViewed: false,
		docs: {
			node: 0,
			angular: 0,
			csharp: 0,
			android: 0,
			java: 0,
			php: 0,
			python: 0,
			ruby: 0,
			go: 0,
			objectivec: 0
		}
	};

	const authHeader = getAuthHeader();
	const httpHeaders = {
		'Authorization': authHeader,
		'content-type' : 'application/x-www-form-urlencoded'
	};
    const options = {
        uri: 'https://mixpanel.com/api/2.0/jql',
        method: 'POST',
        headers: httpHeaders,
        form: {
    		script: query
        }
    };

    const result = request(options, (err, response, body) => {
		if (err) {
			console.log(err);
			reject(err);
		} else {
			let respBody = JSON.parse(body);
			if(respBody !== null && respBody.length > 0 ) {
				// console.log(respBody);
				emailData.transformations = respBody[0];
			}
			runSdkDocsQuery(sdkQuery, emailId, index, emailData);
		}
	});

};

const runSdkDocsQuery = (query, emailId, index, data) => {
	console.log('running sdk docs query');
	const langsMap = {
		node_javascript_lib: 'node',
		angular_javascript_lib: 'angular',
		go_generic_lib: 'go',
		ruby_generic_lib: 'ruby',
		python_generic_lib: 'python',
		php_generic_lib: 'php',
		objc_cocoa_touch_ios_lib: 'objectivec',
		java_gradle_android_lib: 'java',
		java_eclipse_jax_rs: 'java',
		java_eclipse_jre_lib: 'java',
		cs_portable_net_lib: 'csharp',
		cs_universal_windows_platform_lib: 'csharp',
		cs_net_standard_lib: 'csharp'
	};
	const authHeader = getAuthHeader();
	const httpHeaders = {
		'Authorization': authHeader,
		'content-type' : 'application/x-www-form-urlencoded'
	};
    const options = {
        uri: 'https://mixpanel.com/api/2.0/jql',
        method: 'POST',
        headers: httpHeaders,
        form: {
    		script: query
        },
    };
	const result = request(options, (err, response, body) => {
		if (err) {
			console.log(err);
		} else {
			let respBody = JSON.parse(body);
			if(respBody.length > 0) {
				respBody.forEach((item) => {
					const eventName = item.event.name;
					let language = '';
					if(eventName.includes('DocsViewed')) {
						language = item.event.properties.Platform;
						if(IsNotNullOrEmpty(language)) {
							// language will be undefined in case of HTTP docs (curl), need to make decision about that
							// http docs will be represented by item.event.properties.Template 'HTTP_CURL_V1'
							if(language === 'DotNet') {
								language = 'csharp';
							} else if (language === 'IOS') {
								language = 'objectivec';
							}
							data.docs[language.toLowerCase()]++;
							data.docsViewed = true;
						}
					} else if (eventName.includes('SDKGenerated')) {
						language = item.event.properties.Language;
						data.sdks[langsMap[language.toLowerCase()]]++;
						data.sdksGenerated = true;
					}
				});
			}

			dictEmailBody.push(data);

		}
	});
};

const getFormattedDate = (date, isFromDate) => {
	let formattedDate = `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`;
	if(isFromDate) {
		let d = date.getDate();
		let month = date.getMonth();
		const amountToSubtract = 7-d;
		if(d-7 < 1) {
			d = getPrevMonthDate(month) - amountToSubtract;
			month = (month-1+12) % 12;
		} else {
			d -= 7;
		}
		formattedDate = `${date.getFullYear()}-${month+1}-${d}`;
	}

	return formattedDate.toString();
};

const getPrevMonthDate = (currentMonth) => {
	let dateOfMonth;
	const monthsWith31Days = [0, 2, 4, 6, 7, 9, 11];
	if(monthsWith31Days.indexOf(currentMonth-1) > 0) {
		dateOfMonth = 31;
	} else {
		dateOfMonth = (currentMonth == 2)? 28 : 30;
	}

	return dateOfMonth;
};

const populateEmailsArray = (emailId) => {
	if(emailsArray.indexOf(emailId) < 0) {
		emailsArray.push(emailId);
	}
};

const IsNotNullOrEmpty = (item) => {
	return (item !== '' && item !== null && item !== undefined);
};

const processWebhookData = (data) => {
	data.forEach((row) => {
		if(IsNotNullOrEmpty(row.$properties.$email)) {
			populateEmailsArray(row.$properties.$email);
		}		
	});

	console.log(emailsArray);
};

const createLanguagesTable = (item) => {
	let tableCode = '';
	tableCode += `<table style="border:1px solid #e9ecef; border-collapse: collapse; font-family: 'Open Sans';">
		<tr style="border-bottom:1px solid #e9ecef;">
			<th style="font-size:14px; border-right:1px solid #e9ecef; color:#234371; border-collapse: collapse;padding: 10px 20px;">Event</th>
    		<th style="font-size:14px; color:#234371; border-collapse: collapse;padding: 10px 20px;">C#</th>
    		<th style="font-size:14px; color:#234371; border-collapse: collapse;padding: 10px 20px;">Java</th>
    		<th style="font-size:14px; color:#234371; border-collapse: collapse;padding: 10px 20px;">PHP</th>
    		<th style="font-size:14px; color:#234371; border-collapse: collapse;padding: 10px 20px;">NodeJS</th>
    		<th style="font-size:14px; color:#234371; border-collapse: collapse;padding: 10px 20px;">Python</th>
    		<th style="font-size:14px; color:#234371; border-collapse: collapse;padding: 10px 20px;">AngularJS</th>
    		<th style="font-size:14px; color:#234371; border-collapse: collapse;padding: 10px 20px;">Ruby</th>
    		<th style="font-size:14px; color:#234371; border-collapse: collapse;padding: 10px 20px;">Android</th>
    		<th style="font-size:14px; color:#234371; border-collapse: collapse;padding: 10px 20px;">Go</th>
    		<th style="font-size:14px; color:#234371; border-collapse: collapse;padding: 10px 20px;">Objective C</th>
		</tr>`;
	tableCode += `<tr>`;
	tableCode += `<td style="font-size:14px; font-weight:600; border-right:1px solid #e9ecef; color:#234371; border-collapse: collapse;padding: 10px 20px;">SDKs Generated</td>
	    <td style="font-size:12px; color:#234371; border-collapse: collapse;padding: 10px 20px;">${item.sdks.csharp}</td>
	    <td style="font-size:12px; color:#234371; border-collapse: collapse;padding: 10px 20px;">${item.sdks.java}</td>
	    <td style="font-size:12px; color:#234371; border-collapse: collapse;padding: 10px 20px;">${item.sdks.php}</td>
	    <td style="font-size:12px; color:#234371; border-collapse: collapse;padding: 10px 20px;">${item.sdks.node}</td>
	    <td style="font-size:12px; color:#234371; border-collapse: collapse;padding: 10px 20px;">${item.sdks.python}</td>
	    <td style="font-size:12px; color:#234371; border-collapse: collapse;padding: 10px 20px;">${item.sdks.angular}</td>
	    <td style="font-size:12px; color:#234371; border-collapse: collapse;padding: 10px 20px;">${item.sdks.ruby}</td>
	    <td style="font-size:12px; color:#234371; border-collapse: collapse;padding: 10px 20px;">${item.sdks.android}</td>
	    <td style="font-size:12px; color:#234371; border-collapse: collapse;padding: 10px 20px;">${item.sdks.go}</td>
	    <td style="font-size:12px; color:#234371; border-collapse: collapse;padding: 10px 20px;">${item.sdks.objectivec}</td>`;
	tableCode += `</tr>`;
	tableCode += `<tr style="background:#f8fafc;">`;
	tableCode += `<td style="font-size:14px; font-weight:600; border-right:1px solid #e9ecef; color:#234371; border-collapse: collapse;padding: 10px 20px;">Docs Viewed</td>
	    <td style="font-size:12px; color:#234371; border-collapse: collapse;padding: 10px 20px;">${item.docs.csharp}</td>
	    <td style="font-size:12px; color:#234371; border-collapse: collapse;padding: 10px 20px;">${item.docs.java}</td>
	    <td style="font-size:12px; color:#234371; border-collapse: collapse;padding: 10px 20px;">${item.docs.php}</td>
	    <td style="font-size:12px; color:#234371; border-collapse: collapse;padding: 10px 20px;">${item.docs.node}</td>
	    <td style="font-size:12px; color:#234371; border-collapse: collapse;padding: 10px 20px;">${item.docs.python}</td>
	    <td style="font-size:12px; color:#234371; border-collapse: collapse;padding: 10px 20px;">${item.docs.angular}</td>
	    <td style="font-size:12px; color:#234371; border-collapse: collapse;padding: 10px 20px;">${item.docs.ruby}</td>
	    <td style="font-size:12px; color:#234371; border-collapse: collapse;padding: 10px 20px;">${item.docs.android}</td>
	    <td style="font-size:12px; color:#234371; border-collapse: collapse;padding: 10px 20px;">${item.docs.go}</td>
	    <td style="font-size:12px; color:#234371; border-collapse: collapse;padding: 10px 20px;">${item.docs.objectivec}</td>`;
	tableCode += `</tr>`;
	tableCode += `</table>`;
	return tableCode;
};

const sendEmails = () => {
	console.log('send emails called');
	const start = `<p style="font-family: 'Open Sans';">
		Hello there!
	</p>
	<p>
		Thank you for using APIMatic. We love having you! 
	</p>
	<p>
		Here's your weekly wrap up:
	</p>`;
	const end = `<p style="font-family: 'Open Sans';">
		Looks like you had a busy week working with our tools & services. <a href="https://app.hubspot.com/meetings/afraz-qureshi">Book a Demo</a> right now to learn what more you can do with our platform.
	</p>
	<p style="font-family: 'Open Sans';">Have a Great Day!</p>
	<p style="font-family: 'Open Sans'; font-size: 14px;">
		User Experience Manager,
	</p>
	<p style="font-family: 'Open Sans'; font-size: 14px;">
		Maham Shahid
	</p>`;
	const portalAndSdkMsg = `Here's something more you can do with APIMatic. Generate a portal with SDKs today!`;
	const portalAndTransMsg = `Here's something more you can do with APIMatic. Generate a portal with transformer today!`;
	const portalMsg = `Here's something more you can do with APIMatic. Generate a portal today!`;

	fs.writeFile(`${getFormattedDate(new Date())}.json`, JSON.stringify(dictEmailBody), 'utf8', (err) => {
		if(err) {
			console.log(err);
		} else {
			console.log('file saved');
		}
	});
	console.log(dictEmailBody);
	dictEmailBody.forEach((item) => {
		let emailBody = '';
		const includeDivTag = (item.sdksGenerated || item.docsViewed || item.transformations > 0)? true : false;

		emailBody = includeDivTag? '<div style="width:50vw; margin: 0px auto">' : '';

		if(item.sdksGenerated || item.docsViewed) {
			emailBody += createLanguagesTable(item, emailBody);
			emailBody += '<br/><br/>';
		}

		if(item.transformations > 0) {
			emailBody += `<table style="border:1px solid #e9ecef; border-collapse: collapse; font-family: 'Open Sans';">
					<tr style="border-bottom:1px solid #e9ecef;">
						<td style="font-size:12px; color:#234371; font-weight:bold; border-right: 1px solid #e9ecef; border-collapse: collapse;padding: 10px 20px;">${item.transformations}</td>
						<td style="font-size:12px; color:#234371; border-right: 1px solid #e9ecef; border-collapse: collapse;padding: 10px 20px;">APIs Transformed</td>
					</tr>
				</table>`;
		}

		emailBody += includeDivTag? '<br/><br/>' : '';
		if(item.transformations > 0 && !item.sdksGenerated && !item.docsViewed) {
			emailBody += portalAndSdkMsg;
		} else if (item.sdksGenerated && !item.docsViewed && item.transformations < 1) {
			emailBody += portalAndTransMsg;
		} else if (item.sdksGenerated && item.transformations > 0 && !item.docsViewed) {
			emailBody += portalMsg;
		}

		emailBody += includeDivTag? `</div>` : '';

		let msg = {
			to: item.email,
			from: 'sending email ID',
			subject: 'APIMatic Usage Stats',
			text: 'Your usage analytics for this week',
			html: `${start}<br/><br/>${emailBody}<br/><br/>${end}`,
		};
		// console.log(msg);
		const result = sgMail.send(msg);
		result.then(() => {
			console.log('Email sent to: ' + msg.to);
		}, (err) => {
			console.log(err);
		});
	});
};

// support encoded request bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(cors());

app.get('/', (req, res) => {
	res.send('Greetings, young one!');
});

app.listen(3000, () => {
	console.log('Server started; listening on port 3000');
});

app.route('/webhook-data')
	.post((req, res) => {
		const webhookData = JSON.parse(req.body.users);
		res.status(200);
		res.send();
		processWebhookData(webhookData);
	});
