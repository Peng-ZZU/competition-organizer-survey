export const sections = Object.freeze([
  { id: "respondent", title: "Respondent Details" },
  { id: "basic", title: "Basic Information" },
  { id: "statistics", title: "Competition Statistics" },
  { id: "demographics", title: "Participant Demographics" },
  { id: "resources", title: "Competition Resources" },
  { id: "promotion", title: "Promotion and Visibility" },
  { id: "presentation", title: "Presentation of Results" },
  { id: "logistics", title: "Logistical Support" },
  { id: "growth", title: "Impact on Professional and Academic Growth" },
  { id: "feedback", title: "Feedback and Suggestions" },
]);

// Display numbers were renumbered 1-23 after trimming the candidate list; the
// stable ids stay unchanged so answers saved earlier keep matching their question.
export const questions = Object.freeze([
  { id:"q01", number:1, sectionId:"basic", type:"single", prompt:"How many times has this competition been held before this iteration?", options:["0","1-2","3+"], required:true },
  { id:"q02", number:2, sectionId:"basic", type:"single", prompt:"Do you plan to run this competition again next year?", options:["Yes","No"], required:true },
  { id:"q03", number:3, sectionId:"statistics", type:"single", prompt:"How many submissions did your competition receive?", options:["0","1-4","5-9","10+"], required:true },
  { id:"q04", number:4, sectionId:"statistics", type:"single", prompt:"How many research papers related to your competition were submitted to the conference?", options:["0","1-4","5-9","10+"], required:true },
  { id:"q07", number:5, sectionId:"demographics", type:"multi", prompt:"Specify the types of participants you received submissions from", options:["Academic","University Student","High School Student","Industry","Other"], required:true, condition:null, hasOtherDetail:true },
  { id:"q08", number:6, sectionId:"demographics", type:"multi", prompt:"Which geographic areas did participants in your competition come from?", options:["Africa","Asia","Austria","Europe","Latin America","North America","South America"], required:true },
  { id:"q09", number:7, sectionId:"resources", type:"multi", prompt:"Which of the following did your competition provide?", options:["Framework","Sample or Baseline Solutions","Reference Paper","Tutorial","Data","Other"], required:true, condition:null, hasOtherDetail:true },
  { id:"q11", number:8, sectionId:"resources", type:"single", prompt:"Are submitted solutions made publicly available?", options:["Yes","No"], required:true },
  { id:"q12", number:9, sectionId:"promotion", type:"multi", prompt:"How did you advertise your competition?", options:["Newsletter","Website","Twitter","Facebook","Mailing List of Previous or Potential Participants","Publicity Chairs for Conference","Other"], required:true, condition:null, hasOtherDetail:true },
  { id:"q14", number:10, sectionId:"presentation", type:"multi", prompt:"How did participants present their results?", options:["In-Person Presentation","Virtual Presentation","Submitted Program for Ranking","Other"], required:true, condition:null, hasOtherDetail:true },
  { id:"q16", number:11, sectionId:"presentation", type:"single", prompt:"Did you communicate/present/discuss the overall results in public?", options:["Yes","No"], required:true },
  { id:"q18", number:12, sectionId:"logistics", type:"rating", prompt:"How effective was the logistical support provided by the conference?", options:["1","2","3","4","5"], required:true },
  { id:"q19", number:13, sectionId:"logistics", type:"single", prompt:"Were there any logistical issues that affected your competition?", options:["Yes","No"], required:true },
  { id:"q20", number:14, sectionId:"logistics", type:"single", prompt:"Did the competition meet your expectations?", options:["Yes","No"], required:true },
  { id:"q21", number:15, sectionId:"logistics", type:"single", prompt:"Would you participate in this competition again?", options:["Yes","No"], required:true },
  { id:"q24", number:16, sectionId:"growth", type:"single", prompt:"Did you make any new professional connections as a result of this competition?", options:["Yes","No"], required:true },
  { id:"q25", number:17, sectionId:"growth", type:"single", prompt:"Have you used or do you plan to use the outcomes of this competition in your work or studies?", options:["Yes","No"], required:true },
  { id:"q27", number:18, sectionId:"feedback", type:"text", prompt:"What were the main strengths of this competition?", options:[], required:false },
  { id:"q28", number:19, sectionId:"feedback", type:"text", prompt:"What areas need improvement?", options:[], required:false },
  { id:"q31", number:20, sectionId:"feedback", type:"single", prompt:"Currently, all competitions are linked to educational purposes. Would you be interested in competitions not related to education?", options:["Yes","No"], required:true },
  { id:"q32", number:21, sectionId:"feedback", type:"text", prompt:"What was the biggest challenge in organizing the competition?", options:[], required:false },
  { id:"q33", number:22, sectionId:"feedback", type:"text", prompt:"What support would you like the conference/IEEE CIS to provide?", options:[], required:false },
  { id:"q34", number:23, sectionId:"feedback", type:"text", prompt:"What factors limit your willingness to organize the competition again?", options:[], required:false },
]);

export const questionById = new Map(questions.map((question) => [question.id, question]));
