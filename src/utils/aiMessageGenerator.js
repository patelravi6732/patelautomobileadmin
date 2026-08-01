/**
 * AI Professional Message Generator for Bookings and Customer Messages
 * Language Toggle: Gujarati / English
 * Opening Greeting (Gujarati): "પ્રિય ગ્રાહક [Customer Name]," (NO "જી", NO "લાભાર્થી")
 * Supports AI Re-Generation / Variation Cycle
 */

export function generateBookingNotificationMessage(booking, isAccepted, lang = 'GUJARATI', variationIndex = 0, garagePhone = '+91 63524 86040') {
  const customerName = booking?.customer_name || 'Customer';
  const vehicleNumber = booking?.vehicle_number || '';
  const bikeModel = booking?.bike_model || '';
  const prefDate = booking?.preferred_date || '';
  const prefTime = booking?.preferred_time || '';
  const phone = garagePhone || '+91 63524 86040';

  if (lang === 'GUJARATI') {
    if (isAccepted) {
      const gujAcceptedVariations = [
        `પ્રિય ગ્રાહક ${customerName},

પટેલ ઓટોમોબાઇલ્સ (દાંડી, વલસાડ) માં આપનું સ્વાગત છે!

આપના વાહન ${vehicleNumber} (${bikeModel}) માટેની સર્વિસ એપોઇન્ટમેન્ટ સફળતાપૂર્વક સ્વીકારવામાં (ACCEPT) આવી છે.

🔹 તારીખ: ${prefDate}
🔹 સમય: ${prefTime}
🔹 સરનામું: પટેલ ઓટોમોબાઇલ્સ, દાંડી તળાવ પાસે, દાંડી, વલસાડ

કૃપા કરીને નિયત સમયે આપનું વાહન વર્કશોપ પર લાવવા નમ્ર વિનંતી. કોઈ પણ સહાય માટે સંપર્ક કરો: ${phone}.

આભાર,
પટેલ ઓટોમોબાઇલ્સ મેનેજમેન્ટ`,

        `પ્રિય ગ્રાહક ${customerName},

આપને જણાવતાં આનંદ થાય છે કે આપના વાહન ${vehicleNumber} નું સર્વિસ બુકિંગ પટેલ ઓટોમોબાઇલ્સ (દાંડી, વલસાડ) દ્વારા કન્ફર્મ કરવામાં આવ્યું છે.

🔹 બુકિંગ તારીખ: ${prefDate}
🔹 ટાઇમ સ્લોટ: ${prefTime}
🔹 મોડેલ: ${bikeModel}

કૃપા કરી સમયસર પધારવા વિનંતી. વધુ માહિતી માટે સંપર્ક કરો: ${phone}.

આભાર,
પટેલ ઓટોમોબાઇલ્સ`,

        `પ્રિય ગ્રાહક ${customerName},

પટેલ ઓટોમોબાઇલ્સ (દાંડી, વલસાડ) તરફથી નમસ્કાર.

આપનું ${vehicleNumber} (${bikeModel}) નું સર્વિસ બુકિંગ સ્વીકારાઈ ગયું છે.

🔹 તારીખ: ${prefDate} (${prefTime})
🔹 સ્થળ: પટેલ ઓટોમોબાઇલ્સ, દાંડી તળાવ પાસે, વલસાડ

આપના આગમન સમયે વર્કશોપ બે તૈયાર રાખવામાં આવશે. સંપર્ક: ${phone}.

આભાર,
પટેલ ઓટોમોબાઇલ્સ`
      ];

      return gujAcceptedVariations[variationIndex % gujAcceptedVariations.length];
    } else {
      const gujRejectedVariations = [
        `પ્રિય ગ્રાહક ${customerName},

પટેલ ઓટોમોબાઇલ્સ (દાંડી, વલસાડ).

ખેદ સાથે જણાવવાનું કે આપના વાહન ${vehicleNumber} નું સર્વિસ બુકિંગ અત્યારે વર્કશોપ સ્લોટ ફુલ હોવાને કારણે મંજૂર (REJECT) થઈ શક્યું નથી.

કૃપા કરીને અન્ય સમય અથવા તારીખ માટે અમને સંપર્ક કરો: ${phone}.

આભાર,
પટેલ ઓટોમોબાઇલ્સ મેનેજમેન્ટ`,

        `પ્રિય ગ્રાહક ${customerName},

આપના વાહન ${vehicleNumber} ના બુકિંગ સંદર્ભે પટેલ ઓટોમોબાઇલ્સ તરફથી મેસેજ.

દિલગીર છીએ કે આપની પસંદગીની તારીખ ${prefDate} પર વર્કશોપ સ્લોટ ઉપલબ્ધ ન હોવાથી બુકિંગ સ્વીકારી શકાયું નથી.

કૃપા કરી નવો સમય નક્કી કરવા સંપર્ક કરો: ${phone}.

આભાર,
પટેલ ઓટોમોબાઇલ્સ`
      ];

      return gujRejectedVariations[variationIndex % gujRejectedVariations.length];
    }
  } else {
    // ENGLISH
    if (isAccepted) {
      const engAcceptedVariations = [
        `Dear ${customerName},

Greetings from Patel Automobiles (Dandi, Valsad)!

We are pleased to inform you that your service appointment for vehicle ${vehicleNumber} (${bikeModel}) has been ACCEPTED & CONFIRMED.

🔹 Date: ${prefDate}
🔹 Preferred Slot: ${prefTime}
🔹 Location: Patel Automobiles, Near Dandi Pond, Dandi, Valsad

Please bring your vehicle to our workshop at your scheduled time. For any queries, contact us at ${phone}.

Best Regards,
Patel Automobiles Management`,

        `Dear ${customerName},

Thank you for choosing Patel Automobiles, Dandi, Valsad!

Your two-wheeler service booking for ${vehicleNumber} (${bikeModel}) is successfully confirmed for ${prefDate} at ${prefTime}.

Our expert bay will be ready for your arrival. Call us anytime at ${phone}.

Warm Regards,
Patel Automobiles`,

        `Dear ${customerName},

Your service bay reservation at Patel Automobiles (Dandi, Valsad) is APPROVED!

🔹 Vehicle: ${vehicleNumber} (${bikeModel})
🔹 Date: ${prefDate} (${prefTime})

We look forward to serving your vehicle. Contact: ${phone}.

Best Regards,
Patel Automobiles Team`
      ];

      return engAcceptedVariations[variationIndex % engAcceptedVariations.length];
    } else {
      const engRejectedVariations = [
        `Dear ${customerName},

Patel Automobiles (Dandi, Valsad).

We regret to inform you that your service booking for vehicle ${vehicleNumber} could not be accepted due to workshop bay unavailability.

Please contact us to reschedule for an alternate available slot: ${phone}.

Best Regards,
Patel Automobiles Management`,

        `Dear ${customerName},

Regarding your service booking for vehicle ${vehicleNumber} at Patel Automobiles:

We apologize that we are unable to confirm your booking for ${prefDate} as our workshop slots are fully booked.

Please reach out to us at ${phone} to arrange a quick alternate time.

Warm Regards,
Patel Automobiles`
      ];

      return engRejectedVariations[variationIndex % engRejectedVariations.length];
    }
  }
}

export function generateInquiryReplyMessage(msgObj, lang = 'GUJARATI', variationIndex = 0, garagePhone = '+91 63524 86040') {
  const name = msgObj?.name || 'Customer';
  const phone = garagePhone || '+91 63524 86040';
  const userMsg = msgObj?.message || '';

  if (lang === 'GUJARATI') {
    const gujInquiryVariations = [
      `પ્રિય ગ્રાહક ${name},

પટેલ ઓટોમોબાઇલ્સ (દાંડી, વલસાડ) માં આપનું સ્વાગત છે!

આપના મેસેજ "${userMsg}" ના સંદર્ભમાં:

અમારા વર્કશોપમાં આપના વાહનની સંપૂર્ણ ચકાસણી, ઓરિજિનલ સ્પેર પાર્ટ્સ અને એક્સપ્રેસ સર્વિસ ઉપલબ્ધ છે. વધુ વિગત કે બુકિંગ માટે અમને સીધો કોલ અથવા વોટ્સએપ કરો: ${phone}.

આભાર,
પટેલ ઓટોમોબાઇલ્સ મેનેજમેન્ટ`,

      `પ્રિય ગ્રાહક ${name},

પટેલ ઓટોમોબાઇલ્સ (દાંડી, વલસાડ) તરફથી નમસ્કાર.

આપના પૂછપરછ મેસેજ માટે આભાર. આપના વાહનની સર્વિસિંગ તથા રિપેરિંગ માટે અમે આપને શ્રેષ્ઠ ક્વોલિટી અને પ્રામાણિક ચાર્જની ખાતરી આપીએ છીએ.

કૃપા કરી વધુ જાણકારી માટે આ નંબર પર સંપર્ક કરો: ${phone}.

આભાર,
પટેલ ઓટોમોબાઇલ્સ`,

      `પ્રિય ગ્રાહક ${name},

પટેલ ઓટોમોબાઇલ્સ (દાંડી, વલસાડ) પર આપનો સંપર્ક કરવા માટે આભાર.

આપના પ્રશ્ન "${userMsg}" અંગે અમારો ગેરેજ સ્ટાફ આપને સંપૂર્ણ સહાય કરવા તૈયાર છે. આપ આપનું વાહન સીધું જ ગેરેજ પર લાવી શકો છો.

સંપર્ક લાઇન: ${phone}.

આભાર,
પટેલ ઓટોમોબાઇલ્સ`
    ];

    return gujInquiryVariations[variationIndex % gujInquiryVariations.length];
  } else {
    const engInquiryVariations = [
      `Dear ${name},

Greetings from Patel Automobiles (Dandi, Valsad)!

Thank you for reaching out regarding: "${userMsg}".

We provide 100% genuine spare parts, expert two-wheeler engine diagnostics, and express periodic servicing. Feel free to reply here or call us directly at ${phone}.

Best Regards,
Patel Automobiles Management`,

      `Dear ${name},

Thank you for contacting Patel Automobiles in Dandi, Valsad.

Regarding your query: "${userMsg}". Our master mechanics are available to inspect your two-wheeler and provide complete care.

For direct assistance or slot booking, call us at ${phone}.

Warm Regards,
Patel Automobiles`,

      `Dear ${name},

Hello from Patel Automobiles, Dandi, Valsad!

We have received your message regarding your vehicle service query. We assure you of top-grade service with original OEM spare parts.

Contact Helpline: ${phone}.

Best Regards,
Patel Automobiles Team`
    ];

    return engInquiryVariations[variationIndex % engInquiryVariations.length];
  }
}
