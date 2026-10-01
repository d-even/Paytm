import type { LanguageCode } from './types'

/**
 * What the mock agent says, in each app language. The real backend answers in
 * the language the app sends with POST /agent/query; the mock does the same
 * from this phrasebook. Amounts arrive already formatted (e.g. "₹8,400").
 */

type Day = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'

export type Phrasebook = {
  today: (p: { sales: string; payments: number; returning: number }) => string
  todayEmpty: string
  last: (p: { amount: string; instrument: string; minutes: number; visits: number; returning: boolean }) => string
  lastEmpty: string
  regulars: (p: { returning: number; total: number; thisWeek: number }) => string
  dip: (p: { sales: string; pct: number }) => string
  offer: (p: { count: number; redeemed: number; extra: string }) => string
  loan: (p: { amount: string; emi: string; months: number }) => string
  noLoan: string
  fallback: (p: { name: string }) => string
  labels: {
    todaySoFar: string
    payments: (n: number) => string
    lastPayment: string
    returningToday: string
    ofRegulars: (n: number) => string
    salesLastWeek: string
    offerRedeemed: string
    preApproved: string
    loanCaption: (rate: number, months: number) => string
    days: Record<Day, string>
  }
}

const en: Phrasebook = {
  today: ({ sales, payments, returning }) =>
    `You've taken ${sales} so far today from ${payments} payments. ${returning} of them were returning customers.`,
  todayEmpty: 'No payments yet today. Your first bill will show up here.',
  last: ({ amount, instrument, minutes, visits, returning }) =>
    `The last payment was ${amount}, by card ${instrument}, ${minutes < 1 ? 'just now' : `${minutes} min ago`}. ${returning ? `A returning customer on visit ${visits}.` : 'A new customer.'}`,
  lastEmpty: 'No payments yet today.',
  regulars: ({ returning, total, thisWeek }) =>
    `${returning} returning customers came in today. You have ${total} regulars and ${thisWeek} visited this week.`,
  dip: ({ sales, pct }) =>
    `Yesterday (Tuesday) you sold ${sales}, ${pct}% less than last Tuesday. Tuesday has been slow in 6 of the last 8 weeks, so I sent your regulars a Tuesday offer.`,
  offer: ({ count, redeemed, extra }) =>
    `The Tuesday offer went to ${count} regulars on WhatsApp. ${redeemed} used it so far, bringing about ${extra} of extra sales (pilot simulation).`,
  loan: ({ amount, emi, months }) =>
    `You may qualify for a pre-approved loan of ${amount}: EMI ${emi} for ${months} months. This is only a suggestion; the decision is yours.`,
  noLoan: 'There is no loan offer right now.',
  fallback: ({ name }) =>
    `${name}, I can tell you about today's sales, the last payment, your regulars, offers and cashflow. Pick a question below.`,
  labels: {
    todaySoFar: 'Today so far',
    payments: (n) => `${n} payments`,
    lastPayment: 'Last payment',
    returningToday: 'Returning today',
    ofRegulars: (n) => `of ${n} regulars`,
    salesLastWeek: 'Sales last week (₹)',
    offerRedeemed: 'Offer used',
    preApproved: 'Pre-approved (recommend only)',
    loanCaption: (rate, months) => `${rate}% a year · ${months} months`,
    days: { Mon: 'Mon', Tue: 'Tue', Wed: 'Wed', Thu: 'Thu', Fri: 'Fri', Sat: 'Sat', Sun: 'Sun' },
  },
}

const hinglish: Phrasebook = {
  today: ({ sales, payments, returning }) =>
    `Aaj ab tak ${sales} ki sale hui hai, ${payments} payments se. Inme ${returning} returning customers the.`,
  todayEmpty: 'Aaj abhi tak koi payment nahi aaya. Pehla bill yahan dikhega.',
  last: ({ amount, instrument, minutes, visits, returning }) =>
    `Aakhri payment ${amount} ka tha, card ${instrument} se, ${minutes < 1 ? 'abhi abhi' : `${minutes} minute pehle`}. ${returning ? `Returning customer, ${visits}vi visit.` : 'Naya customer.'}`,
  lastEmpty: 'Aaj abhi tak koi payment nahi aaya.',
  regulars: ({ returning, total, thisWeek }) =>
    `Aaj ${returning} returning customers aaye. Aapke ${total} regular customers hain, is hafte ${thisWeek} aaye.`,
  dip: ({ sales, pct }) =>
    `Kal (Mangalwar) ${sales} ki sale hui, pichle Mangalwar se ${pct}% kam. Pichle 8 mein se 6 hafton mein Mangalwar slow raha, isliye maine regulars ko Tuesday offer bheja.`,
  offer: ({ count, redeemed, extra }) =>
    `Tuesday offer WhatsApp par ${count} regulars ko gaya. ${redeemed} ne use kiya, lagbhag ${extra} ki extra sale (pilot simulation).`,
  loan: ({ amount, emi, months }) =>
    `Aap ${amount} ke pre-approved loan ke liye eligible ho sakte hain: EMI ${emi} × ${months} mahine. Yeh sirf salah hai, faisla aapka.`,
  noLoan: 'Abhi koi loan offer nahi hai.',
  fallback: ({ name }) =>
    `${name} ji, main aaj ki sale, aakhri payment, regular customers, offers aur cashflow ke baare mein bata sakta hoon. Neeche se koi sawaal chuniye.`,
  labels: {
    todaySoFar: 'Aaj ab tak',
    payments: (n) => `${n} payments`,
    lastPayment: 'Aakhri payment',
    returningToday: 'Aaj returning',
    ofRegulars: (n) => `${n} regulars mein se`,
    salesLastWeek: 'Pichle hafte ki sale (₹)',
    offerRedeemed: 'Offer use hua',
    preApproved: 'Pre-approved (sirf salah)',
    loanCaption: (rate, months) => `${rate}% saalana · ${months} mahine`,
    days: { Mon: 'Som', Tue: 'Mangal', Wed: 'Budh', Thu: 'Guru', Fri: 'Shukr', Sat: 'Shani', Sun: 'Ravi' },
  },
}

const hi: Phrasebook = {
  today: ({ sales, payments, returning }) =>
    `आज अब तक ${sales} की बिक्री हुई है, ${payments} पेमेंट से। इनमें ${returning} लौटकर आए ग्राहक थे।`,
  todayEmpty: 'आज अभी तक कोई पेमेंट नहीं आया। पहला बिल यहाँ दिखेगा।',
  last: ({ amount, instrument, minutes, visits, returning }) =>
    `आखिरी पेमेंट ${amount} का था, कार्ड ${instrument} से, ${minutes < 1 ? 'अभी-अभी' : `${minutes} मिनट पहले`}। ${returning ? `लौटकर आए ग्राहक, ${visits}वीं विज़िट।` : 'नए ग्राहक।'}`,
  lastEmpty: 'आज अभी तक कोई पेमेंट नहीं आया।',
  regulars: ({ returning, total, thisWeek }) =>
    `आज ${returning} लौटकर आए ग्राहक आए। आपके ${total} नियमित ग्राहक हैं, इस हफ़्ते ${thisWeek} आए।`,
  dip: ({ sales, pct }) =>
    `कल (मंगलवार) ${sales} की बिक्री हुई, पिछले मंगलवार से ${pct}% कम। पिछले 8 में से 6 हफ़्तों में मंगलवार धीमा रहा, इसलिए मैंने नियमित ग्राहकों को मंगलवार ऑफ़र भेजा।`,
  offer: ({ count, redeemed, extra }) =>
    `मंगलवार ऑफ़र WhatsApp पर ${count} नियमित ग्राहकों को गया। ${redeemed} ने इस्तेमाल किया, लगभग ${extra} की अतिरिक्त बिक्री (पायलट सिमुलेशन)।`,
  loan: ({ amount, emi, months }) =>
    `आप ${amount} के प्री-अप्रूव्ड लोन के लिए योग्य हो सकते हैं: EMI ${emi} × ${months} महीने। यह सिर्फ़ सलाह है, फ़ैसला आपका।`,
  noLoan: 'अभी कोई लोन ऑफ़र नहीं है।',
  fallback: ({ name }) =>
    `${name} जी, मैं आज की बिक्री, आखिरी पेमेंट, नियमित ग्राहक, ऑफ़र और कैशफ़्लो के बारे में बता सकता हूँ। नीचे से कोई सवाल चुनिए।`,
  labels: {
    todaySoFar: 'आज अब तक',
    payments: (n) => `${n} पेमेंट`,
    lastPayment: 'आखिरी पेमेंट',
    returningToday: 'आज लौटकर आए',
    ofRegulars: (n) => `${n} नियमित ग्राहकों में से`,
    salesLastWeek: 'पिछले हफ़्ते की बिक्री (₹)',
    offerRedeemed: 'ऑफ़र इस्तेमाल हुआ',
    preApproved: 'प्री-अप्रूव्ड (सिर्फ़ सलाह)',
    loanCaption: (rate, months) => `${rate}% सालाना · ${months} महीने`,
    days: { Mon: 'सोम', Tue: 'मंगल', Wed: 'बुध', Thu: 'गुरु', Fri: 'शुक्र', Sat: 'शनि', Sun: 'रवि' },
  },
}

const mr: Phrasebook = {
  today: ({ sales, payments, returning }) =>
    `आज आतापर्यंत ${sales} ची विक्री झाली, ${payments} पेमेंटमधून. त्यात ${returning} परत आलेले ग्राहक होते.`,
  todayEmpty: 'आज अजून एकही पेमेंट आलं नाही. पहिलं बिल इथे दिसेल.',
  last: ({ amount, instrument, minutes, visits, returning }) =>
    `शेवटचं पेमेंट ${amount} चं होतं, कार्ड ${instrument} ने, ${minutes < 1 ? 'आत्ताच' : `${minutes} मिनिटांपूर्वी`}. ${returning ? `परत आलेले ग्राहक, ${visits}वी भेट.` : 'नवीन ग्राहक.'}`,
  lastEmpty: 'आज अजून एकही पेमेंट आलं नाही.',
  regulars: ({ returning, total, thisWeek }) =>
    `आज ${returning} परत आलेले ग्राहक आले. तुमचे ${total} नेहमीचे ग्राहक आहेत, या आठवड्यात ${thisWeek} आले.`,
  dip: ({ sales, pct }) =>
    `काल (मंगळवार) ${sales} ची विक्री झाली, मागच्या मंगळवारपेक्षा ${pct}% कमी. मागच्या 8 पैकी 6 आठवड्यांत मंगळवार मंद होता, म्हणून मी नेहमीच्या ग्राहकांना मंगळवार ऑफर पाठवली.`,
  offer: ({ count, redeemed, extra }) =>
    `मंगळवार ऑफर WhatsApp वर ${count} नेहमीच्या ग्राहकांना गेली. ${redeemed} जणांनी वापरली, सुमारे ${extra} ची जास्त विक्री (पायलट सिम्युलेशन).`,
  loan: ({ amount, emi, months }) =>
    `तुम्ही ${amount} च्या प्री-अप्रूव्ह्ड कर्जासाठी पात्र असू शकता: EMI ${emi} × ${months} महिने. हा फक्त सल्ला आहे, निर्णय तुमचा.`,
  noLoan: 'सध्या कर्जाची कोणतीही ऑफर नाही.',
  fallback: ({ name }) =>
    `${name} जी, मी आजची विक्री, शेवटचं पेमेंट, नेहमीचे ग्राहक, ऑफर आणि कॅशफ्लोबद्दल सांगू शकतो. खालून एखादा प्रश्न निवडा.`,
  labels: {
    todaySoFar: 'आज आतापर्यंत',
    payments: (n) => `${n} पेमेंट`,
    lastPayment: 'शेवटचं पेमेंट',
    returningToday: 'आज परत आलेले',
    ofRegulars: (n) => `${n} नेहमीच्या ग्राहकांपैकी`,
    salesLastWeek: 'मागच्या आठवड्याची विक्री (₹)',
    offerRedeemed: 'ऑफर वापरली',
    preApproved: 'प्री-अप्रूव्ह्ड (फक्त सल्ला)',
    loanCaption: (rate, months) => `${rate}% वार्षिक · ${months} महिने`,
    days: { Mon: 'सोम', Tue: 'मंगळ', Wed: 'बुध', Thu: 'गुरु', Fri: 'शुक्र', Sat: 'शनि', Sun: 'रवि' },
  },
}

export const phrasebooks: Record<LanguageCode, Phrasebook> = { en, hinglish, hi, mr }

/** Question topics the mock understands, matched on words from all four languages. */
export type Intent = 'last' | 'regulars' | 'loan' | 'offer' | 'today' | 'dip' | 'other'

const INTENTS: [Exclude<Intent, 'other'>, RegExp][] = [
  ['last', /last payment|latest payment|aakhri|aakhiri|akhri|आख़?िरी|ख़िरी|अंतिम|शेवट/i],
  ['regulars', /regular|returning|customer|grahak|ग्राहक|रेगुलर|नियमित/i],
  ['loan', /loan|credit|udhaar|udhar|लोन|कर्ज|उधार|क्रेडिट/i],
  ['offer', /offer|campaign|whatsapp|ऑफ़र|ऑफर/i],
  ['today', /today|so far|aaj|abhi tak|kamai|आज|अब तक|आतापर्यंत|कमाई/i],
  ['dip', /slow|dip|low|yesterday|week|kam|kyun|hafte|kal|धीम|मंद|कम|क्यों|हफ़्ते|हफ्ते|आठवड|कल|काल/i],
]

export function detectIntent(question: string): Intent {
  return INTENTS.find(([, pattern]) => pattern.test(question))?.[0] ?? 'other'
}
