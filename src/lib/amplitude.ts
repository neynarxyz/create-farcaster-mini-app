import { APP_URL } from "./constants";

// Amplitude tracking -- only runs if configured via the CLI or in the .env file
export function logEvent(
  eventType: string, 
  eventProperties: Record<string, any> = {}, 
  deviceId: string | null = null
) {
  if (process.env.NEXT_PUBLIC_ANALYTICS_ENABLED?.toLowerCase() !== 'true' || process.env.NODE_ENV !== "production") {
    return;
  }

  const event = {
    event_type: eventType,
    api_key: '0c4fe46171b9bb8eca2ca61eb71f2e19',
    time: Date.now(),
    user_id: APP_URL,
    ...(deviceId && { device_id: deviceId }),
    ...(Object.keys(eventProperties).length && { event_properties: eventProperties })
  };

  fetch('https://api2.amplitude.com/2/httpapi', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: '0c4fe46171b9bb8eca2ca61eb71f2e19',
      events: [event]
    })
  }).catch(error => {
    console.error('Amplitude tracking error:', error);
  });
}