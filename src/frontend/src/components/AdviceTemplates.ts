// Bengali Advice Templates — Starter set + user-saved custom templates

export interface AdviceTemplate {
  id: string;
  text: string;
  category: string;
  isCustom?: boolean;
}

export const STARTER_ADVICE_TEMPLATES: AdviceTemplate[] = [
  // Rest & Recovery
  { id: "a1", text: "পর্যাপ্ত বিশ্রাম নিন", category: "বিশ্রাম" },
  { id: "a2", text: "বিছানায় সম্পূর্ণ বিশ্রাম নিন", category: "বিশ্রাম" },
  { id: "a3", text: "পরিশ্রমের কাজ এড়িয়ে চলুন", category: "বিশ্রাম" },
  // Medication
  { id: "b1", text: "নিয়মিত ওষুধ সেবন করুন", category: "ওষুধ" },
  { id: "b2", text: "ডাক্তারের পরামর্শ ছাড়া ওষুধ বন্ধ করবেন না", category: "ওষুধ" },
  { id: "b3", text: "নির্ধারিত সময়ে ওষুধ খান", category: "ওষুধ" },
  // Hydration & Diet
  {
    id: "c1",
    text: "পর্যাপ্ত পানি পান করুন (দিনে কমপক্ষে ৮ গ্লাস)",
    category: "খাদ্য ও পানীয়",
  },
  { id: "c2", text: "তৈলাক্ত ও মশলাদার খাবার পরিহার করুন", category: "খাদ্য ও পানীয়" },
  { id: "c3", text: "হালকা ও সহজপাচ্য খাবার খান", category: "খাদ্য ও পানীয়" },
  { id: "c4", text: "ফলমূল ও শাকসবজি বেশি খান", category: "খাদ্য ও পানীয়" },
  { id: "c5", text: "লবণ ও চিনি কম খান", category: "খাদ্য ও পানীয়" },
  { id: "c6", text: "বাইরের খাবার এড়িয়ে চলুন", category: "খাদ্য ও পানীয়" },
  // Lifestyle
  { id: "d1", text: "ধূমপান ও মাদক পরিহার করুন", category: "জীবনযাত্রা" },
  { id: "d2", text: "মদ্যপান থেকে বিরত থাকুন", category: "জীবনযাত্রা" },
  { id: "d3", text: "নিয়মিত হাঁটুন ও হালকা ব্যায়াম করুন", category: "জীবনযাত্রা" },
  { id: "d4", text: "রাতে পর্যাপ্ত ঘুমান (৭-৮ ঘণ্টা)", category: "জীবনযাত্রা" },
  { id: "d5", text: "মানসিক চাপ কমানোর চেষ্টা করুন", category: "জীবনযাত্রা" },
  // Follow-up
  { id: "e1", text: "৭ দিন পর পুনরায় দেখান", category: "ফলো-আপ" },
  { id: "e2", text: "১৪ দিন পর পুনরায় দেখান", category: "ফলো-আপ" },
  { id: "e3", text: "১ মাস পর পুনরায় দেখান", category: "ফলো-আপ" },
  { id: "e4", text: "৩ মাস পর পুনরায় দেখান", category: "ফলো-আপ" },
  { id: "e5", text: "প্রয়োজনে যেকোনো সময় দেখাতে পারেন", category: "ফলো-আপ" },
  // Emergency warnings
  { id: "f1", text: "জ্বর বাড়লে দ্রুত যোগাযোগ করুন", category: "সতর্কতা" },
  { id: "f2", text: "শ্বাসকষ্ট বাড়লে দ্রুত হাসপাতালে যান", category: "সতর্কতা" },
  { id: "f3", text: "বুকে ব্যথা হলে অবিলম্বে চিকিৎসক দেখান", category: "সতর্কতা" },
  { id: "f4", text: "অবস্থার অবনতি হলে জরুরি বিভাগে যান", category: "সতর্কতা" },
  {
    id: "f5",
    text: "ওষুধে পার্শ্বপ্রতিক্রিয়া দেখা দিলে ডাক্তারকে জানান",
    category: "সতর্কতা",
  },
  // Diabetes specific
  { id: "g1", text: "নিয়মিত রক্তের সুগার পরীক্ষা করুন", category: "ডায়াবেটিস" },
  {
    id: "g2",
    text: "মিষ্টি ও কার্বোহাইড্রেট জাতীয় খাবার কমিয়ে খান",
    category: "ডায়াবেটিস",
  },
  { id: "g3", text: "প্রতিদিন ৩০ মিনিট হাঁটুন", category: "ডায়াবেটিস" },
  // Hypertension
  { id: "h1", text: "নিয়মিত রক্তচাপ পরিমাপ করুন", category: "উচ্চ রক্তচাপ" },
  { id: "h2", text: "লবণ খাওয়া কমিয়ে দিন", category: "উচ্চ রক্তচাপ" },
  { id: "h3", text: "মানসিক উত্তেজনা পরিহার করুন", category: "উচ্চ রক্তচাপ" },
];

const CUSTOM_KEY = "medicare_custom_advice_templates";

export function getCustomTemplates(): AdviceTemplate[] {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getAllTemplates(): AdviceTemplate[] {
  return [...STARTER_ADVICE_TEMPLATES, ...getCustomTemplates()];
}

export function saveCustomTemplate(template: AdviceTemplate): void {
  const existing = getCustomTemplates();
  const updated = [...existing.filter((t) => t.id !== template.id), template];
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(updated));
}

export function deleteCustomTemplate(id: string): void {
  const existing = getCustomTemplates();
  localStorage.setItem(
    CUSTOM_KEY,
    JSON.stringify(existing.filter((t) => t.id !== id)),
  );
}

export function getAdviceCategories(): string[] {
  const all = getAllTemplates();
  return ["সব", ...Array.from(new Set(all.map((t) => t.category)))];
}
