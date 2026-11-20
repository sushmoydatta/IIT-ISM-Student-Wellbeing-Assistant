// On-device companion used in demo mode (and as a fallback if the live API is down).
// Replies follow a simple person-centred pattern: reflect the feeling → normalise →
// offer one small, concrete step → invite the student to keep talking.
// Content mirrors the documents in backend/data/.
(function () {
  const tool = (label, open) => ({ label, open });
  const say = (label, text) => ({ label, say: text || label });

  const INTENTS = [
    {
      id: "greeting",
      match: /^(hi+|hey+|hello|hii+|yo|namaste|good (morning|evening|afternoon|night))\b/,
      replies: [
        "Hey, it’s good to see you here. What’s been on your mind lately?",
        "Hi. No pressure to have it all figured out. What’s one thing that’s been sitting with you today?",
      ],
      actions: [say("Exams are stressing me out"), say("I feel lonely"), say("I can’t sleep")],
    },
    {
      id: "thanks",
      match: /\b(thank(s| you)|thx|ty|helped|that helps)\b/,
      replies: [
        "I’m really glad that helped a little. Small steps count. Is there anything else you want to talk through?",
        "Thank you for taking a moment for yourself. That matters. I’m here whenever you need.",
      ],
    },
    {
      id: "crisis_adjacent",
      match: /\b(hopeless|worthless|empty|give up|no point|tired of (living|everything)|disappear)\b/,
      replies: [
        "It sounds like things feel really dark right now, and I’m glad you said it out loud. Feelings like this can be a sign you’ve been carrying too much for too long.\n\nCan I ask gently: are you having any thoughts of hurting yourself or not wanting to be here? Whatever the answer, you won’t be judged.",
      ],
      actions: [tool("See who I can talk to", "help"), say("I’m safe, just really low")],
    },
    {
      id: "exam",
      match: /\b(exams?|endsems?|end sems?|midsems?|mid sems?|quiz(zes)?|tests?|grades?|cgpa|gpa|marks|backlogs?|fail(ed|ing)?|study|studying|assignments?|deadlines?|viva|labs?)\b/,
      replies: [
        "Exam pressure here can feel relentless, like everyone else is coping better than you. They usually aren’t; they’re just quieter about it.\n\nOne thing that helps: shrink the task. Instead of “study for endsems”, pick one tiny, specific block, like 5 problems from one chapter, and do just that. Small wins give back the sense of control stress takes away.\n\nWhat’s the exam that’s worrying you most right now?",
        "It makes sense you’re stressed. You care about how this goes. Try a 25-minute focused sprint, then 5 minutes completely away from the screen. And protect your sleep: memory actually consolidates while you rest, so an all-nighter usually costs more than it earns.\n\nWhat part feels hardest: starting, focusing, or the fear of the result?",
      ],
      actions: [tool("2-min breathing reset", "breathe"), tool("Reframe an anxious thought", "reframe"), say("I keep procrastinating")],
    },
    {
      id: "procrastination",
      match: /\b(too big to start|procrastinat\w*|can'?t (start|focus|concentrate)|distracted|lazy|unmotivated|no motivation|wasting time|doomscroll\w*)\b/,
      replies: [
        "Procrastination usually isn’t laziness. It’s often the brain avoiding a feeling, like dread, overwhelm, or fear of not doing it well enough.\n\nTry the two-minute rule: open the document and do only two minutes. Starting is the hardest part; momentum tends to follow. And go easy on yourself afterwards. Guilt makes the next start harder, not easier.\n\nWhat’s the task you’ve been avoiding?",
      ],
      actions: [say("It feels too big to start"), tool("Reframe the guilt", "reframe")],
    },
    {
      id: "sleep",
      match: /\b(sleep|insomnia|can'?t sleep|awake|nightmares?|tired|exhausted|night ?out|all[- ]?nighter)\b/,
      replies: [
        "Not sleeping well makes everything heavier: mood, focus, patience. You’re not imagining that.\n\nA few gentle things: keep the same wake-up time even on weekends, put the phone away 30–60 minutes before bed, and if you’ve been lying awake for ~20 minutes, get up and do something calm in dim light before trying again.\n\nIs it more that your mind won’t switch off, or that your schedule doesn’t leave room to sleep?",
      ],
      actions: [tool("Wind down with slow breathing", "breathe"), say("My mind won’t switch off")],
    },
    {
      id: "anxiety",
      match: /\b(anxious|anxiety|panic|panicking|nervous|scared|fear|worried|worry|overthink\w*|racing|mind won'?t (stop|switch off|shut up)|heart (is )?pounding|can'?t breathe|spiral\w*)\b/,
      replies: [
        "That sounds really uncomfortable. When anxiety kicks in, your body’s alarm system is doing its job a little too loudly. It’s not a sign that something is wrong with you.\n\nRight now, try breathing in for 4 and out for 6. A longer exhale is one of the fastest ways to tell your nervous system you’re safe. If thoughts are spiralling, grounding through your senses can help too.\n\nWould you like to try one of those with me?",
        "Overthinking is exhausting: your mind keeps rehearsing things that haven’t happened. It might help to write the worry down and ask: “What would I tell a friend who had this thought?”\n\nWhat’s the thought that keeps coming back?",
      ],
      actions: [tool("Breathe with me", "breathe"), tool("5-4-3-2-1 grounding", "ground"), tool("Reframe the thought", "reframe")],
    },
    {
      id: "homesick",
      match: /\b(homesick|miss (my )?(home|family|mom|mum|dad|parents|friends)|home ?sick|far from home|first year|fresher)\b/,
      replies: [
        "Missing home is so normal, especially in first year, around festivals, or when you’re unwell and just want someone to take care of you.\n\nSome students find a rhythm helps, like a fixed call home a few times a week rather than all day, while slowly building small routines here: regular mess timings, one club, studying in a common room.\n\nWhat do you miss most?",
      ],
      actions: [say("I haven’t made friends yet"), say("My family pressures me a lot")],
    },
    {
      id: "lonely",
      match: /\b(lonely|alone|no friends|(made|make|making) (any )?friends|isolated|left out|don'?t fit in|nobody talks|no one (to talk|understands))\b/,
      replies: [
        "Feeling lonely on a campus full of people can be confusing, and it’s easy to assume everyone else has already found their group. Honestly, many people feel exactly what you’re feeling.\n\nFriendships usually grow from small, repeated contact: the same mess table, a club you actually enjoy, saying yes to one plan a week even when staying in feels easier. It’s okay if it takes a semester.\n\nIs there anyone, even one person, you feel a bit comfortable around?",
      ],
      actions: [say("Not really"), say("How do I join clubs?")],
    },
    {
      id: "clubs",
      match: /\b(clubs?|societ(y|ies)|fests?|join (a|any)|hobb(y|ies))\b/,
      replies: [
        "Joining something is one of the easiest ways to meet people without the pressure of “making friends”. You’re just showing up for a shared interest.\n\nMost clubs and societies post recruitment and open sessions on student groups and notice boards at the start of each semester, but many are happy to take people mid-year too. Pick one that matches something you genuinely enjoy, even a little, and go twice before deciding.\n\nWhat kind of things did you enjoy before college?",
      ],
    },
    {
      id: "duration",
      match: /\b(few weeks|weeks now|months|a long time|so long|always)\b/,
      replies: [
        "Thank you for telling me. When a feeling sticks around for weeks, it’s worth giving it proper attention, not because something is wrong with you, but because you deserve support that’s more than a chatbot.\n\nA counsellor can help you untangle it, and it’s free for students. Would you like to see the ways to reach someone?",
      ],
      actions: [tool("Show me", "help"), say("What happens in a first session?")],
    },
    {
      id: "low",
      match: /\b(sad|low|down|depressed|depression|crying|cry|numb|unhappy|miserable|heavy|lost|broken|hurt)\b/,
      replies: [
        "I’m sorry you’re feeling this way. Thank you for saying it rather than holding it in. You don’t have to explain it perfectly.\n\nSometimes low days just need gentleness: water, food, a short walk outside, a message to one person. If it’s been going on most days for a couple of weeks, talking to a counsellor can make a real difference. That’s what they’re there for, and it’s free for students.\n\nHow long have you been feeling like this?",
      ],
      actions: [say("A few weeks now"), say("Just today"), tool("Talk to someone", "help")],
    },
    {
      id: "burnout",
      match: /\b(burn(ed|t)? ?out|burnout|drained|overwhelm\w*|too much|so much work|can'?t keep up|pressure)\b/,
      replies: [
        "That sounds like a lot to carry. When demands stay high and recovery stays low for too long, even rest stops feeling restful. That’s burnout, and it’s not a personal failure.\n\nCould you pick one thing to drop, delay, or ask for help with this week? And one small thing you do purely because you enjoy it?\n\nWhat’s taking up the most of your energy right now?",
      ],
      actions: [tool("Take a breathing break", "breathe"), say("Placements and internships")],
    },
    {
      id: "career",
      match: /\b(placements?|internships?|interns?|jobs?|careers?|resumes?|cv|interviews?|offers?|future|compar\w*|imposter|not good enough|everyone else|peers?|batchmates?|leetcode|coding rank)\b/,
      replies: [
        "Placement season can make it feel like your whole worth is one number or one offer. It isn’t. Comparison is especially brutal here because you’re surrounded by talented people, and you mostly see their highlights.\n\nTry measuring yourself against who you were three months ago, not against batchmates. And remember that careers are long and winding; very few people end up where their first job pointed.\n\nWhat’s the part that’s weighing on you most?",
      ],
      actions: [tool("Reframe “I’m not good enough”", "reframe"), say("I feel like an imposter")],
    },
    {
      id: "relationships",
      match: /\b(breakup|break up|broke up|girlfriend|boyfriend|partner|relationship|crush|friend(s)? (fight|ignor\w*)|roommate|fight with|argument)\b/,
      replies: [
        "Relationship pain can take up so much space in your head that it’s hard to think about anything else. What you’re feeling is real, even if others say “just move on”.\n\nBe kind to yourself in the basics: sleep, food, people who feel safe. It’s okay to feel it before you fix it.\n\nDo you want to tell me a bit about what happened?",
      ],
    },
    {
      id: "family",
      match: /\b(parents?|family|mom|mum|dad|expectations?|disappoint\w*)\b/,
      replies: [
        "Family expectations can feel heavy, especially when you care about not letting them down. It’s possible to love your family and still feel pressured by them.\n\nSometimes it helps to separate what they expect from what you want, even just on paper. You don’t have to resolve it all at once.\n\nWhat do you feel they expect from you right now?",
      ],
      actions: [tool("Reframe a guilty thought", "reframe")],
    },
    {
      id: "counselling",
      match: /\b(counsel\w*|therap\w*|psychologist|psychiatrist|professional|talk to someone|appointment|book|helpline)\b/,
      replies: [
        "Reaching out to a counsellor is a strong, practical step. It doesn’t mean something is seriously wrong. People go for stress, family stuff, academics, or just to think out loud with someone trained to listen.\n\nIIT (ISM) runs a free student counselling service through the Dean of Students’ office; check the institute website or your student email for current timings. If you want to talk to someone right now, Tele-MANAS (14416) is free and open 24×7.\n\nWould it help to talk through what you might say in a first session?",
      ],
      actions: [tool("Show all helplines", "help"), say("What happens in a first session?")],
    },
    {
      id: "first_session",
      match: /\b(first session|what (do|should) i say|what happens)\b/,
      replies: [
        "In a first session the counsellor will usually ask what brought you in, then mostly listen. You decide how much to share. It’s fine to start with “I’m not sure how to explain it, but I haven’t been feeling like myself.”\n\nYou can also bring notes. Some people write down two or three things they want to mention so they don’t freeze up.",
      ],
      actions: [tool("Show helplines", "help")],
    },
  ];

  const FALLBACK = [
    "I hear you. Can you tell me a little more about what that’s been like for you?",
    "That sounds like it’s been on your mind. What part of it feels the heaviest right now?",
    "Thank you for sharing that. How are you feeling about it, right in this moment?",
    "I’m with you. If it’s hard to put into words, you could start with how your body feels: tense, tired, restless?",
  ];

  const MOOD_OPENERS = {
    calm: { text: "Glad you’re feeling okay. That’s worth noticing. Want to check in on anything, or explore what Sukoon can do?", actions: [say("Give me a wellbeing tip"), tool("Try 1 minute of breathing", "breathe"), tool("How does this work?", "about")] },
    anxious: { text: "Thanks for telling me. Anxiety can make everything feel urgent. We can slow down together first, or you can just tell me what’s going on. Whatever feels right.", actions: [tool("Breathe first", "breathe"), tool("Ground myself", "ground"), say("Exams are stressing me out")] },
    low: { text: "I’m sorry it’s a low day. You don’t need a reason, and you don’t need to explain it well. I’m here to listen.", actions: [say("I don’t know why I feel like this"), say("I feel lonely"), tool("Talk to a person", "help")] },
    overwhelmed: { text: "When everything piles up at once, it’s hard to know where to start. Let’s take one breath first. Then you can tell me what’s on the pile.", actions: [tool("One minute of breathing", "breathe"), say("I have too many deadlines"), say("Placements and internships")] },
    numb: { text: "Feeling numb or flat is more common than people talk about. It can be the mind’s way of protecting itself when things have been a lot. No pressure here. Say whatever, or nothing at all.", actions: [tool("5-4-3-2-1 grounding", "ground"), say("I’ve felt this way for weeks"), tool("Talk to a person", "help")] },
    curious: { text: "Welcome. I’m Sukoon, a small companion for IIT (ISM) students. You can talk to me about stress, sleep, loneliness, exams, or anything else. There are also quick tools up top to breathe, ground yourself, or reframe a hard thought.", actions: [tool("How does this work?", "about"), say("Exams are stressing me out"), tool("Try the breathing tool", "breathe")] },
    none: { text: "Hey. I’m here. What’s on your mind?", actions: [say("Exams are stressing me out"), say("I feel homesick"), say("How do I talk to a counsellor?")] },
  };

  const TIPS = [
    "Here’s a small one: drink a glass of water and step outside for two minutes. Look at something far away. Your eyes and nervous system both relax when you change focal distance.",
    "Try a “done list” tonight: write three things you did today, however small. Brains under stress remember failures more than wins; this evens it out.",
    "Message one person you haven’t talked to in a while, just “thought of you”. Connection is one of the strongest protective factors for wellbeing.",
  ];

  const used = {};
  function pick(id, list) {
    const i = (used[id] = ((used[id] ?? -1) + 1) % list.length);
    return list[i];
  }

  function respond(text) {
    const t = text.toLowerCase().replace(/[‘’]/g, "'");
    if (/\b(tip|advice|suggest\w*)\b/.test(t) && /\b(wellbeing|wellness|mental|tip)\b/.test(t)) {
      return { text: pick("tip", TIPS) + "\n\nWant another, or is something specific on your mind?", actions: [say("Another tip", "Give me a wellbeing tip")] };
    }
    for (const intent of INTENTS) {
      if (intent.match.test(t)) {
        return { text: pick(intent.id, intent.replies), actions: intent.actions || [], intent: intent.id };
      }
    }
    return { text: pick("fallback", FALLBACK), actions: [], intent: "fallback" };
  }

  window.Companion = { respond, opener: m => MOOD_OPENERS[m] || MOOD_OPENERS.none };
})();
