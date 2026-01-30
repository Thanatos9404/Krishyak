// Indian States with Districts and Tehsils for Farmer Registration
export const indianStates = [
  {
    name: "Andhra Pradesh",
    nameHi: "आंध्र प्रदेश",
    districts: [
      { name: "Anantapur", nameHi: "अनंतपुर", tehsils: ["Anantapur", "Dharmavaram", "Kadiri", "Penukonda"] },
      { name: "Chittoor", nameHi: "चित्तूर", tehsils: ["Chittoor", "Tirupati", "Madanapalle", "Punganur"] },
      { name: "Guntur", nameHi: "गुंटूर", tehsils: ["Guntur", "Narasaraopet", "Tenali", "Bapatla"] },
      { name: "Krishna", nameHi: "कृष्णा", tehsils: ["Vijayawada", "Machilipatnam", "Gudivada", "Nuzvid"] },
      { name: "Kurnool", nameHi: "कुर्नूल", tehsils: ["Kurnool", "Nandyal", "Adoni", "Yemmiganur"] }
    ]
  },
  {
    name: "Bihar",
    nameHi: "बिहार",
    districts: [
      { name: "Patna", nameHi: "पटना", tehsils: ["Patna Sadar", "Danapur", "Barh", "Masaurhi"] },
      { name: "Gaya", nameHi: "गया", tehsils: ["Gaya Sadar", "Bodh Gaya", "Sherghati", "Tekari"] },
      { name: "Muzaffarpur", nameHi: "मुज़फ्फरपुर", tehsils: ["Muzaffarpur", "Kanti", "Motipur", "Saraiya"] },
      { name: "Bhagalpur", nameHi: "भागलपुर", tehsils: ["Bhagalpur Sadar", "Kahalgaon", "Sultanganj", "Naugachhia"] }
    ]
  },
  {
    name: "Gujarat",
    nameHi: "गुजरात",
    districts: [
      { name: "Ahmedabad", nameHi: "अहमदाबाद", tehsils: ["Ahmedabad City", "Daskroi", "Sanand", "Dholka"] },
      { name: "Surat", nameHi: "सूरत", tehsils: ["Surat City", "Choryasi", "Kamrej", "Olpad"] },
      { name: "Rajkot", nameHi: "राजकोट", tehsils: ["Rajkot", "Gondal", "Jetpur", "Dhoraji"] },
      { name: "Vadodara", nameHi: "वडोदरा", tehsils: ["Vadodara", "Padra", "Savli", "Vaghodia"] }
    ]
  },
  {
    name: "Haryana",
    nameHi: "हरियाणा",
    districts: [
      { name: "Ambala", nameHi: "अंबाला", tehsils: ["Ambala", "Barara", "Naraingarh", "Shahzadpur"] },
      { name: "Karnal", nameHi: "करनाल", tehsils: ["Karnal", "Assandh", "Nilokheri", "Indri"] },
      { name: "Hisar", nameHi: "हिसार", tehsils: ["Hisar", "Hansi", "Barwala", "Narnaund"] },
      { name: "Rohtak", nameHi: "रोहतक", tehsils: ["Rohtak", "Meham", "Kalanaur", "Lakhan Majra"] }
    ]
  },
  {
    name: "Karnataka",
    nameHi: "कर्नाटक",
    districts: [
      { name: "Bengaluru Urban", nameHi: "बेंगलुरु शहरी", tehsils: ["Bengaluru North", "Bengaluru South", "Anekal"] },
      { name: "Mysuru", nameHi: "मैसूरु", tehsils: ["Mysuru", "Nanjangud", "T Narasipura", "Hunsur"] },
      { name: "Belagavi", nameHi: "बेलगावी", tehsils: ["Belagavi", "Chikkodi", "Gokak", "Raibag"] },
      { name: "Dharwad", nameHi: "धारवाड़", tehsils: ["Dharwad", "Hubli", "Kalghatgi", "Kundgol"] }
    ]
  },
  {
    name: "Kerala",
    nameHi: "केरल",
    districts: [
      { name: "Thiruvananthapuram", nameHi: "तिरुवनंतपुरम", tehsils: ["Thiruvananthapuram", "Neyyattinkara", "Nedumangad"] },
      { name: "Ernakulam", nameHi: "एर्णाकुलम", tehsils: ["Kochi", "Aluva", "Muvattupuzha", "Kothamangalam"] },
      { name: "Thrissur", nameHi: "त्रिशूर", tehsils: ["Thrissur", "Chalakudy", "Kodungallur", "Mukundapuram"] }
    ]
  },
  {
    name: "Madhya Pradesh",
    nameHi: "मध्य प्रदेश",
    districts: [
      { name: "Bhopal", nameHi: "भोपाल", tehsils: ["Huzur", "Berasia", "Phanda"] },
      { name: "Indore", nameHi: "इंदौर", tehsils: ["Indore", "Mhow", "Depalpur", "Sanwer"] },
      { name: "Jabalpur", nameHi: "जबलपुर", tehsils: ["Jabalpur", "Sihora", "Patan", "Kundam"] },
      { name: "Gwalior", nameHi: "ग्वालियर", tehsils: ["Gwalior", "Dabra", "Bhitarwar", "Morar"] },
      { name: "Ujjain", nameHi: "उज्जैन", tehsils: ["Ujjain", "Nagda", "Tarana", "Mahidpur"] }
    ]
  },
  {
    name: "Maharashtra",
    nameHi: "महाराष्ट्र",
    districts: [
      { name: "Mumbai", nameHi: "मुंबई", tehsils: ["Mumbai City", "Mumbai Suburban", "Andheri", "Borivali"] },
      { name: "Pune", nameHi: "पुणे", tehsils: ["Pune City", "Haveli", "Mulshi", "Maval", "Baramati"] },
      { name: "Nagpur", nameHi: "नागपुर", tehsils: ["Nagpur Urban", "Nagpur Rural", "Hingna", "Kamptee"] },
      { name: "Nashik", nameHi: "नासिक", tehsils: ["Nashik", "Igatpuri", "Sinnar", "Niphad", "Dindori"] },
      { name: "Aurangabad", nameHi: "औरंगाबाद", tehsils: ["Aurangabad", "Khuldabad", "Kannad", "Sillod"] }
    ]
  },
  {
    name: "Punjab",
    nameHi: "पंजाब",
    districts: [
      { name: "Ludhiana", nameHi: "लुधियाना", tehsils: ["Ludhiana East", "Ludhiana West", "Jagraon", "Samrala"] },
      { name: "Amritsar", nameHi: "अमृतसर", tehsils: ["Amritsar-I", "Amritsar-II", "Ajnala", "Baba Bakala"] },
      { name: "Jalandhar", nameHi: "जालंधर", tehsils: ["Jalandhar-I", "Jalandhar-II", "Nakodar", "Phillaur"] },
      { name: "Patiala", nameHi: "पटियाला", tehsils: ["Patiala", "Rajpura", "Nabha", "Samana"] }
    ]
  },
  {
    name: "Rajasthan",
    nameHi: "राजस्थान",
    districts: [
      { name: "Jaipur", nameHi: "जयपुर", tehsils: ["Jaipur", "Amber", "Sanganer", "Chaksu", "Bassi"] },
      { name: "Jodhpur", nameHi: "जोधपुर", tehsils: ["Jodhpur", "Bilara", "Osian", "Shergarh"] },
      { name: "Udaipur", nameHi: "उदयपुर", tehsils: ["Udaipur", "Mavli", "Girwa", "Salumber"] },
      { name: "Kota", nameHi: "कोटा", tehsils: ["Kota", "Ladpura", "Digod", "Sangod"] }
    ]
  },
  {
    name: "Tamil Nadu",
    nameHi: "तमिलनाडु",
    districts: [
      { name: "Chennai", nameHi: "चेन्नई", tehsils: ["Chennai North", "Chennai South", "Chennai Central"] },
      { name: "Coimbatore", nameHi: "कोयंबटूर", tehsils: ["Coimbatore North", "Coimbatore South", "Pollachi", "Mettupalayam"] },
      { name: "Madurai", nameHi: "मदुरई", tehsils: ["Madurai North", "Madurai South", "Melur", "Peraiyur"] },
      { name: "Salem", nameHi: "सेलम", tehsils: ["Salem", "Attur", "Mettur", "Omalur"] }
    ]
  },
  {
    name: "Telangana",
    nameHi: "तेलंगाना",
    districts: [
      { name: "Hyderabad", nameHi: "हैदराबाद", tehsils: ["Hyderabad", "Secunderabad", "Golconda"] },
      { name: "Rangareddy", nameHi: "रंगारेड्डी", tehsils: ["Rajendranagar", "Chevella", "Ibrahimpatnam", "Shamshabad"] },
      { name: "Warangal", nameHi: "वारंगल", tehsils: ["Warangal", "Hanamkonda", "Parkal", "Narsampet"] }
    ]
  },
  {
    name: "Uttar Pradesh",
    nameHi: "उत्तर प्रदेश",
    districts: [
      { name: "Lucknow", nameHi: "लखनऊ", tehsils: ["Lucknow", "Mohanlalganj", "Bakshi Ka Talab", "Malihabad"] },
      { name: "Kanpur", nameHi: "कानपुर", tehsils: ["Kanpur", "Bilhaur", "Ghatampur", "Bhitargaon"] },
      { name: "Varanasi", nameHi: "वाराणसी", tehsils: ["Varanasi", "Pindra", "Rajatalab", "Kashi Vidyapeeth"] },
      { name: "Agra", nameHi: "आगरा", tehsils: ["Agra", "Fatehabad", "Kiraoli", "Etmadpur"] },
      { name: "Prayagraj", nameHi: "प्रयागराज", tehsils: ["Allahabad", "Soraon", "Phulpur", "Handia"] }
    ]
  },
  {
    name: "West Bengal",
    nameHi: "पश्चिम बंगाल",
    districts: [
      { name: "Kolkata", nameHi: "कोलकाता", tehsils: ["Kolkata", "Port", "Garden Reach"] },
      { name: "North 24 Parganas", nameHi: "उत्तर 24 परगना", tehsils: ["Barasat", "Barrackpore", "Basirhat", "Bongaon"] },
      { name: "Howrah", nameHi: "हावड़ा", tehsils: ["Howrah", "Uluberia", "Amta", "Shyampur"] },
      { name: "Murshidabad", nameHi: "मुर्शिदाबाद", tehsils: ["Berhampore", "Kandi", "Lalbag", "Jangipur"] }
    ]
  },
  {
    name: "Chhattisgarh",
    nameHi: "छत्तीसगढ़",
    districts: [
      { name: "Raipur", nameHi: "रायपुर", tehsils: ["Raipur", "Arang", "Abhanpur", "Tilda"] },
      { name: "Bilaspur", nameHi: "बिलासपुर", tehsils: ["Bilaspur", "Takhatpur", "Masturi", "Kota"] },
      { name: "Durg", nameHi: "दुर्ग", tehsils: ["Durg", "Bhilai", "Patan", "Dhamdha"] }
    ]
  },
  {
    name: "Odisha",
    nameHi: "ओडिशा",
    districts: [
      { name: "Bhubaneswar", nameHi: "भुवनेश्वर", tehsils: ["Bhubaneswar", "Khurda", "Jatni", "Balipatna"] },
      { name: "Cuttack", nameHi: "कटक", tehsils: ["Cuttack Sadar", "Athagarh", "Banki", "Baramba"] },
      { name: "Ganjam", nameHi: "गंजाम", tehsils: ["Berhampur", "Chhatrapur", "Aska", "Khallikote"] }
    ]
  },
  {
    name: "Jharkhand",
    nameHi: "झारखंड",
    districts: [
      { name: "Ranchi", nameHi: "रांची", tehsils: ["Ranchi", "Kanke", "Ratu", "Bundu"] },
      { name: "Dhanbad", nameHi: "धनबाद", tehsils: ["Dhanbad", "Jharia", "Sindri", "Katras"] },
      { name: "Jamshedpur", nameHi: "जमशेदपुर", tehsils: ["Jamshedpur", "Jugsalai", "Potka", "Golmuri"] }
    ]
  },
  {
    name: "Assam",
    nameHi: "असम",
    districts: [
      { name: "Guwahati", nameHi: "गुवाहाटी", tehsils: ["Guwahati", "Dispur", "Palashbari", "Chandrapur"] },
      { name: "Jorhat", nameHi: "जोरहाट", tehsils: ["Jorhat", "Titabor", "Mariani", "Teok"] },
      { name: "Dibrugarh", nameHi: "डिब्रूगढ़", tehsils: ["Dibrugarh", "Naharkatia", "Tingkhong", "Lahowal"] }
    ]
  },
  {
    name: "Uttarakhand",
    nameHi: "उत्तराखंड",
    districts: [
      { name: "Dehradun", nameHi: "देहरादून", tehsils: ["Dehradun", "Rishikesh", "Vikasnagar", "Sahaspur"] },
      { name: "Haridwar", nameHi: "हरिद्वार", tehsils: ["Haridwar", "Roorkee", "Laksar", "Bhagwanpur"] },
      { name: "Nainital", nameHi: "नैनीताल", tehsils: ["Nainital", "Haldwani", "Ramnagar", "Bhimtal"] }
    ]
  },
  {
    name: "Himachal Pradesh",
    nameHi: "हिमाचल प्रदेश",
    districts: [
      { name: "Shimla", nameHi: "शिमला", tehsils: ["Shimla", "Theog", "Rampur", "Rohru"] },
      { name: "Kangra", nameHi: "कांगड़ा", tehsils: ["Kangra", "Dharamshala", "Palampur", "Nurpur"] },
      { name: "Mandi", nameHi: "मंडी", tehsils: ["Mandi", "Sundernagar", "Jogindernagar", "Sarkaghat"] }
    ]
  },
  {
    name: "Jammu and Kashmir",
    nameHi: "जम्मू और कश्मीर",
    districts: [
      { name: "Srinagar", nameHi: "श्रीनगर", tehsils: ["Srinagar", "Hazratbal", "Khanyar", "Harwan"] },
      { name: "Jammu", nameHi: "जम्मू", tehsils: ["Jammu", "Akhnoor", "R.S. Pura", "Bishnah"] },
      { name: "Anantnag", nameHi: "अनंतनाग", tehsils: ["Anantnag", "Pahalgam", "Kokernag", "Dooru"] }
    ]
  },
  {
    name: "Goa",
    nameHi: "गोवा",
    districts: [
      { name: "North Goa", nameHi: "उत्तर गोवा", tehsils: ["Panaji", "Mapusa", "Ponda", "Bicholim"] },
      { name: "South Goa", nameHi: "दक्षिण गोवा", tehsils: ["Margao", "Mormugao", "Quepem", "Sanguem"] }
    ]
  },
  {
    name: "Tripura",
    nameHi: "त्रिपुरा",
    districts: [
      { name: "West Tripura", nameHi: "पश्चिम त्रिपुरा", tehsils: ["Agartala", "Mohanpur", "Jirania", "Bishalgarh"] },
      { name: "South Tripura", nameHi: "दक्षिण त्रिपुरा", tehsils: ["Udaipur", "Sabroom", "Amarpur", "Belonia"] }
    ]
  },
  {
    name: "Meghalaya",
    nameHi: "मेघालय",
    districts: [
      { name: "East Khasi Hills", nameHi: "पूर्व खासी हिल्स", tehsils: ["Shillong", "Cherrapunji", "Pynursla", "Mawphlang"] },
      { name: "West Garo Hills", nameHi: "पश्चिम गारो हिल्स", tehsils: ["Tura", "Dadenggre", "Selsella", "Tikrikilla"] }
    ]
  },
  {
    name: "Manipur",
    nameHi: "मणिपुर",
    districts: [
      { name: "Imphal West", nameHi: "इम्फाल पश्चिम", tehsils: ["Imphal", "Lamshang", "Patsoi", "Wangoi"] },
      { name: "Imphal East", nameHi: "इम्फाल पूर्व", tehsils: ["Porompat", "Sawombung", "Keirao Bitra", "Jiribam"] }
    ]
  },
  {
    name: "Nagaland",
    nameHi: "नागालैंड",
    districts: [
      { name: "Kohima", nameHi: "कोहिमा", tehsils: ["Kohima", "Jakhama", "Sechu Zubza", "Botsa"] },
      { name: "Dimapur", nameHi: "दीमापुर", tehsils: ["Dimapur", "Chumukedima", "Medziphema", "Niuland"] }
    ]
  },
  {
    name: "Arunachal Pradesh",
    nameHi: "अरुणाचल प्रदेश",
    districts: [
      { name: "Itanagar", nameHi: "ईटानगर", tehsils: ["Itanagar", "Naharlagun", "Banderdewa", "Doimukh"] },
      { name: "Tawang", nameHi: "तवांग", tehsils: ["Tawang", "Lumla", "Mukto", "Jang"] }
    ]
  }
];

export const getDistrictsByState = (stateName) => {
  const state = indianStates.find(s => s.name === stateName);
  return state ? state.districts : [];
};

export const getTehsilsByDistrict = (stateName, districtName) => {
  const state = indianStates.find(s => s.name === stateName);
  if (!state) return [];
  const district = state.districts.find(d => d.name === districtName);
  return district ? district.tehsils : [];
};

export default indianStates;
