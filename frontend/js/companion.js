// On-device companion used in demo mode (and as a fallback if the live API is down).
//
// How it picks a reply:
//   1. Every topic scores the message by weighted keyword patterns (English + common Hinglish).
//      The highest score wins, so "panic attack in the lab" goes to anxiety, not exams.
//   2. Short replies ("yes", "idk", "ok") are read in the context of the last question asked.
//      A "yes" to "are you having thoughts of hurting yourself?" escalates to the safety card.
//   3. Replies follow a person-centred pattern: reflect the feeling → normalise →
//      one small, concrete step → an open question.
// Content mirrors the documents in backend/data/.
(function () {
  "use strict";
  const tool = (label, open) => ({ label, open });
  const say = (label, text) => ({ label, say: text || label });

  // [pattern, weight]. Patterns are matched on a normalised, lower-case message.
  const T = [
    {
      id: "greeting", only: true,
      kw: [[/^(hi+|hey+|hello+|hii+|yo|namaste|namaskar|hola|sup|wassup|what'?s up|good (morning|evening|afternoon|night))\b/, 3]],
      replies: [
        "Hey, it’s good to see you here. What’s been on your mind lately?",
        "Hi. No pressure to have it all figured out. What’s one thing that’s been sitting with you today?",
      ],
      actions: [say("Exams are stressing me out"), say("I feel lonely"), say("I can’t sleep")],
    },
    {
      id: "safe_continue",
      kw: [[/\bi'?m safe\b|\bi am safe\b|\bnot going to hurt myself\b|\bjust want to (keep )?talk/, 4]],
      replies: [
        "Thank you for letting me know. I’m really glad you’re safe right now. We can keep talking for as long as you like.\n\nWhat’s been the hardest part of today?",
      ],
      actions: [say("Everything feels heavy"), say("I’m stressed about studies"), tool("Breathe for a minute", "breathe")],
    },
    {
      id: "crisis_adjacent", ask: "safety",
      kw: [[/\b(hopeless|worthless|give up on everything|no point( in anything)?|tired of (living|everything|life)|disappear|sab bekar|kuch matlab nahi|don'?t see a future|nothing makes me happy|can'?t feel anything anymore|empty inside)\b/, 4], [/\bempty\b/, 2]],
      replies: [
        "It sounds like things feel really dark right now, and I’m glad you said it out loud. Feelings like this can be a sign you’ve been carrying too much for too long.\n\nCan I ask gently: are you having any thoughts of hurting yourself or not wanting to be here? Whatever the answer, you won’t be judged.",
      ],
      actions: [say("Yes, sometimes"), say("No, I’m safe, just really low", "I’m safe, just really low")],
    },
    {
      id: "isolation", ask: "safety",
      kw: [[/\bhaven'?t (left|gone out of) my room\b|\bnot left my room\b|\bstaying in (my )?room all day\b|\bskipping (all )?(classes|meals)\b|\bhaven'?t (eaten|showered)\b/, 4]],
      replies: [
        "I’m glad you told me. When we pull away from everything, it’s usually because things have become too much, not because we don’t care.\n\nCould you do one tiny thing in the next hour? Open the window, drink some water, or walk to the mess and back. Nothing more.\n\nHave you been feeling low for a while? And are you safe right now?",
      ],
      actions: [say("I’m safe, just really low", "I’m safe, just really low"), say("It’s been a few weeks"), tool("Talk to a person", "help")],
    },
    {
      id: "anxiety",
      kw: [
        [/\b(anxious|anxiety|panic(king)?|panic attacks?|nervous|scared|afraid|fear(ful)?|worried|worry(ing)?|tense|on edge|uneasy)\b/, 3],
        [/\boverthink\w*|\bspiral\w*|racing (thoughts|heart)|heart (is )?(racing|races|pounding)|can'?t breathe|chest (is )?tight|shaking|mind won'?t (stop|switch off|shut up)|mind is all over the place|can'?t calm down/, 3],
        [/\bghabra\w*|\bdar lag\w*|\btension\b/, 3],
      ],
      replies: [
        "That sounds really uncomfortable. When anxiety kicks in, your body’s alarm system is doing its job a little too loudly. It’s not a sign that something is wrong with you.\n\nRight now, try breathing in for 4 and out for 6. A longer exhale is one of the fastest ways to tell your nervous system you’re safe. If thoughts are spiralling, grounding through your senses helps too.\n\nWould you like to try one of those with me?",
        "Overthinking is exhausting: your mind keeps rehearsing things that haven’t happened. It can help to write the worry down and ask, “What would I tell a friend who had this thought?”\n\nWhat’s the thought that keeps coming back?",
      ],
      actions: [tool("Breathe with me", "breathe"), tool("5-4-3-2-1 grounding", "ground"), tool("Reframe the thought", "reframe")],
      follow: ["Thank you for sharing that. Naming the worry already takes some of its power away. If it’s still loud, a 1-minute breathing round can take the edge off before we look at it together.\n\nWhat would feel most helpful right now: calming down first, or talking it through?"],
    },
    {
      id: "presentation",
      kw: [[/\b(presentation|present(ing)? in front|public speaking|viva|interview nerves|stage fear|speak in class)\b/, 4]],
      replies: [
        "Nerves before speaking are your body getting ready, not a sign you’ll do badly. Even experienced speakers feel it.\n\nA few things that help: breathe out slowly just before you start, rehearse the first 30 seconds until it’s automatic, and focus on one friendly face. The audience wants you to do well.\n\nWhen is it, and what part worries you most?",
      ],
      actions: [tool("Breathe before you go", "breathe"), tool("Reframe “I’ll mess up”", "reframe")],
    },
    {
      id: "exam",
      kw: [
        [/\b(exams?|endsems?|end ?sems?|midsems?|mid ?sems?|quiz(zes)?|tests?|backlogs?|re-?exam|supplementary|syllabus|revision)\b/, 3],
        [/\b(grades?|cgpa|sgpa|gpa|marks|pointer|study|studying|assignments?|deadlines?|lab reports?|submissions?)\b/, 2],
        [/\bpadhai\b|\bpadh(na|ta|ti)\b|\bexam ka\b/, 3],
      ],
      replies: [
        "Exam pressure here can feel relentless, like everyone else is coping better than you. They usually aren’t; they’re just quieter about it.\n\nOne thing that helps: shrink the task. Instead of “study for endsems”, pick one tiny, specific block, like 5 problems from one chapter, and do just that. Small wins give back the sense of control stress takes away.\n\nWhat’s the exam that’s worrying you most right now?",
        "It makes sense you’re stressed. You care about how this goes. Try a 25-minute focused sprint, then 5 minutes completely away from the screen. And protect your sleep: memory consolidates while you rest, so an all-nighter usually costs more than it earns.\n\nWhat part feels hardest: starting, focusing, or the fear of the result?",
      ],
      actions: [tool("2-min breathing reset", "breathe"), tool("Reframe an anxious thought", "reframe"), say("I keep procrastinating")],
      follow: ["Okay. Let’s make it smaller. If you had only 25 minutes today, which single topic would make you feel a bit more in control? Start there, and nothing else. Tell me how it goes."],
    },
    {
      id: "failure",
      kw: [[/\b(failed|fail|backlog|bad (grade|result|marks)|flunk\w*|got [a-d] grade|low marks|didn'?t clear)\b/, 4], [/\b(useless|stupid|dumb|not smart enough|disappointment)\b/, 3]],
      replies: [
        "That really stings, and it’s okay to feel upset about it. But one result is a data point, not a verdict on who you are or where you’ll end up. Plenty of people with backlogs and low pointers go on to do work they love.\n\nWhen you’re ready, it helps to ask: what is one thing I’d do differently next time? Just one.\n\nHow are you feeling about it right now?",
      ],
      actions: [tool("Reframe “I’m useless”", "reframe"), say("I’m scared to tell my parents")],
    },
    {
      id: "distraction",
      kw: [
        [/\b(reels?|instagram|insta|youtube|shorts|netflix|doomscroll\w*|scrolling|phone addiction|screen time|gaming|playing games|games all day|valorant|bgmi)\b/, 4],
        [/\b(procrastinat\w*|can'?t (start|focus|concentrate)|distracted|lazy|unmotivated|no motivation|wasting time|wasted (the )?(whole )?(day|time)|too big to start)\b/, 3], [/\bmann nahi lag\w*/, 4],
      ],
      replies: [
        "Procrastination usually isn’t laziness. It’s often the brain avoiding a feeling, like dread, boredom or fear of not doing it well enough, and the phone is the easiest escape.\n\nTwo things that work: put the phone in another room (not just face-down) for one 25-minute block, and use the two-minute rule: open the work and do only two minutes. Starting is the hardest part. And go easy on yourself afterwards; guilt makes the next start harder.\n\nWhat’s the task you’ve been avoiding?",
      ],
      actions: [say("It feels too big to start"), tool("Reframe the guilt", "reframe")],
      follow: ["That’s a good one to pick. Can you cut it down to a first step so small it feels almost silly? Like “open the PDF and read the first page”. Try just that, then come back and tell me."],
    },
    {
      id: "time_balance",
      kw: [[/\b(time management|manage (my )?time|balance|juggl\w*|too many (things|commitments)|clubs and (acads|academics|studies)|no time for|schedule|routine|timetable|overcommit\w*)\b/, 4]],
      replies: [
        "Balancing acads, clubs, friends and rest at IIT is genuinely hard. There’s always more you could be doing.\n\nA simple approach: each Sunday, put the fixed things in first (classes, labs, sleep, meals), then block 2–3 study slots per day, and protect at least one slot a week for something you do only for fun. If something new comes up, ask “what will this replace?” before saying yes.\n\nWhat’s taking up more time than you’d like right now?",
      ],
      actions: [say("Clubs take all my time"), say("I have no time for hobbies"), tool("Breathe first", "breathe")],
    },
    {
      id: "sleep",
      kw: [
        [/\b(sleep|slept|insomnia|can'?t sleep|awake (all night|till)|nightmares?|all[- ]?nighter|night ?out|sleep(ing)? at [1-6] ?am|[2-6] ?am)\b/, 4],
        [/\b(tired|exhausted|fatigue|drowsy|sleepy|neend)\b/, 2],
      ],
      replies: [
        "Not sleeping well makes everything heavier: mood, focus, patience. You’re not imagining that.\n\nA few gentle things: keep the same wake-up time even on weekends, put the phone away 30–60 minutes before bed, and if you’ve been lying awake for ~20 minutes, get up and do something calm in dim light before trying again. Shifting bedtime by 20 minutes a night works better than a big jump.\n\nIs it more that your mind won’t switch off, or that your schedule doesn’t leave room to sleep?",
      ],
      actions: [tool("Wind down with slow breathing", "breathe"), say("My mind won’t switch off")],
    },
    {
      id: "homesick",
      kw: [[/\b(homesick|home ?sick|miss (my )?(home|family|mom|mum|maa|dad|papa|parents|friends|ghar)|far from home|ghar ki yaad|ghar yaad|yaad aa rahi)\b/, 5], [/\b(first year|fresher)\b/, 1]],
      replies: [
        "Missing home is so normal, especially in first year, around festivals, or when you’re unwell and just want someone to take care of you.\n\nSome students find a rhythm helps, like a fixed call home a few times a week rather than all day, while slowly building small routines here: regular mess timings, one club, studying in a common room.\n\nWhat do you miss most?",
      ],
      actions: [say("I haven’t made friends yet"), say("My family pressures me a lot")],
      follow: ["That makes so much sense. It’s okay to miss it and still slowly make a life here; both can be true. Is there a small piece of home you could bring into your week, like a food, a song, or a call at a fixed time?"],
    },
    {
      id: "lonely",
      kw: [[/\b(lonely|alone|no friends|don'?t have (any )?friends|isolated|left out|don'?t fit in|nobody talks|no one (to talk|understands)|their (own )?group|except me|(made|make|making) (any )?friends|akela|nobody texts|no one texts|texts? me back|ignored by everyone)\b/, 4]],
      replies: [
        "Feeling lonely on a campus full of people can be confusing, and it’s easy to assume everyone else has already found their group. Honestly, many people feel exactly what you’re feeling.\n\nFriendships usually grow from small, repeated contact: the same mess table, a club you actually enjoy, saying yes to one plan a week even when staying in feels easier. It’s okay if it takes a semester.\n\nIs there anyone, even one person, you feel a bit comfortable around?",
      ],
      actions: [say("Not really"), say("How do I join clubs?")],
      follow: ["Thank you for being honest. Let’s start really small: this week, could you say hi to one person you see regularly, like a lab partner or someone at the mess? Connection usually starts that small."],
    },
    {
      id: "clubs",
      kw: [[/\b(clubs?|societ(y|ies)|fests?|join (a|any)|extracurricular\w*|chapter|team)\b/, 3]],
      replies: [
        "Joining something is one of the easiest ways to meet people without the pressure of “making friends”. You’re just showing up for a shared interest.\n\nMost clubs and societies post recruitment and open sessions on student groups and notice boards at the start of each semester, but many are happy to take people mid-year too. Pick one that matches something you genuinely enjoy, even a little, and go twice before deciding.\n\nWhat kind of things did you enjoy before college?",
      ],
    },
    {
      id: "hobbies",
      kw: [
        [/\b(hobb(y|ies)|pastime|for fun|creative|paint\w*|draw\w*|music|guitar|sing\w*|danc\w*|writ(e|ing) (poems|stories)|photography|sketch\w*|read(ing)? novels|used to (love|enjoy|paint|play|draw|sing|write))\b/, 4],
        [/\b(bored|boring|nothing to do|this weekend|free time)\b/, 3],
      ],
      replies: [
        "Hobbies aren’t a distraction from success; they’re part of what keeps you well enough to succeed. Doing something just because you enjoy it lowers stress and reminds you that you’re more than your grades.\n\nTry “joy in small doses”: 20 minutes, twice a week, of something you used to love or are curious about. No goal, no performance. If you’ve drifted from an old hobby, start smaller than you think you need to.\n\nWhat’s something you’ve enjoyed before, or always wanted to try?",
      ],
      actions: [say("I have no time for hobbies"), say("I don’t know what I enjoy anymore")],
      follow: ["That sounds lovely. What would the smallest version of that look like this week, like 20 minutes on Sunday evening? Putting it on the calendar makes it far more likely to happen."],
    },
    {
      id: "purpose",
      kw: [[/\b(passion|purpose|dream(s)?|don'?t know what (i want|to do)|what (to do|i want) with my life|direction|calling|meaning|lost in life|wrong branch|hate my branch|career confusion|which path|don'?t enjoy (coding|it|my branch|engineering) anymore|lost interest in)\b/, 4]],
      replies: [
        "Not knowing what you want is incredibly common, especially at 18–22, and especially in a system that rushed you into a branch before you had time to explore. Passion usually isn’t found by thinking; it grows from trying things and noticing what pulls you back.\n\nA small experiment: this month, try two things you’re curious about (a course, a club, a side project, a talk) and keep a note of what gave you energy and what drained it.\n\nWhat’s something that made you lose track of time, even once?",
      ],
      actions: [say("Nothing comes to mind"), say("My parents want a different path for me")],
      follow: ["That’s a real clue. Energy and curiosity are better guides than “passion”. What’s one small way to do more of that in the next two weeks?"],
    },
    {
      id: "motivation",
      kw: [[/\b(motivat\w*|discipline|consistent|consistency|stay focused|keep going|lost (my )?drive|no energy to)\b/, 3]],
      replies: [
        "Motivation is unreliable: it usually comes after you start, not before. That’s why systems beat willpower.\n\nPick one tiny habit linked to something you already do: “after breakfast, I open my notes for 10 minutes.” Track it with a tick, not a score. Missing a day is fine; missing two in a row is the only thing to avoid.\n\nWhat’s one thing you want to be more consistent with?",
      ],
      actions: [say("Studying every day"), say("Going to the gym")],
    },
    {
      id: "health",
      kw: [[/\b(gym|workout|exercise|running|fitness|walk(ing)?|yoga|diet|junk( food)?|eating (badly|too much|nothing)|skip(ping)? meals|weight|body image)\b/, 4]],
      replies: [
        "Looking after your body is one of the most underrated ways to look after your mind. Even a 15-minute walk lifts mood and focus for hours.\n\nStart easier than you think: a short walk after dinner, one proper meal from the mess instead of skipping it, or two short workouts a week. Consistency matters far more than intensity.\n\nWhat would feel realistic for you this week?",
      ],
    },
    {
      id: "grief",
      kw: [[/\b(passed away|died|death|lost my (grand(mother|father|ma|pa)|nani|dadi|nana|dada|mother|father|mom|dad|friend|pet|dog|cat)|funeral|grieving|grief|nani|dadi)\b/, 6]],
      replies: [
        "I’m so sorry for your loss. Grief can come in waves, sometimes when you least expect it, and there’s no right way or timeline to feel it, especially when you’re far from family and still expected to keep up with classes.\n\nIt’s okay to ask professors for an extension, to cry, to not feel much at all, or to talk about them. If you’d like, tell me a little about them.",
      ],
      actions: [tool("Talk to a counsellor", "help"), tool("Breathe for a minute", "breathe")],
      follow: ["Thank you for telling me about them. Holding onto memories like that is part of how we carry people with us. Be gentle with yourself this week, and let someone close to you know how you’re doing."],
    },
    {
      id: "faculty",
      kw: [[/\b(prof(essor)?|faculty|teacher|ta|instructor|hod|guide|supervisor)\b.*\b(humiliat\w*|insult\w*|scold\w*|shout\w*|embarrass\w*|unfair|rude|hates? me|yelled)\b|\b(humiliat\w*|insult\w*|scold\w*|embarrass\w*)\b.*\b(class|lab|prof\w*)\b/, 6]],
      replies: [
        "That sounds really hurtful. Being embarrassed in front of others by someone with authority can stay with you for days, and it says more about how that moment was handled than about your worth.\n\nIf it keeps happening or crosses a line, you can talk to your faculty advisor, the HOD, or the Dean of Students’ office. You don’t have to just absorb it.\n\nHow are you feeling about going back to that class?",
      ],
      actions: [tool("Reframe the thought it left", "reframe"), say("I feel embarrassed")],
    },
    {
      id: "listen",
      kw: [[/\b(just need (someone|somebody) to (listen|talk)|need to vent|can i vent|want to vent|just listen|need to talk)\b/, 6]],
      replies: ["I’m here, and I’m listening. Take your time. There’s no right way to say it, and you don’t need to make it make sense. What’s going on?"],
    },
    {
      id: "normal",
      kw: [[/\b(is (it|this) normal|am i (normal|weird|crazy|overreacting)|does anyone else feel)\b/, 5]],
      replies: ["Yes, what you’re feeling is far more common than it looks from the outside. Most students go through stretches like this, and many feel exactly what you’re describing but don’t say it out loud. Feeling it doesn’t mean something is wrong with you.\n\nWould you like to tell me a bit more about what you’re noticing?"],
    },
    {
      id: "low",
      kw: [
        [/\b(sad|low|down|depressed|depression|crying|cry|numb|unhappy|miserable|heavy|lost|broken|hurt|not okay|not ok|feeling bad|stuck)\b/, 3], [/\bkuch (accha|acha) nahi\b|\bdil nahi\b/, 4],
        [/\b(udaas|dukhi|mann nahi)\b/, 3],
      ],
      replies: [
        "I’m sorry you’re feeling this way. Thank you for saying it rather than holding it in. You don’t have to explain it perfectly.\n\nLow days need gentleness: water, food, a short walk outside, a message to one person. If it’s been going on most days for a couple of weeks, talking to a counsellor can make a real difference. That’s what they’re there for, and it’s free for students.\n\nHow long have you been feeling like this?",
      ],
      actions: [say("A few weeks now"), say("Just today"), tool("Talk to someone", "help")],
    },
    {
      id: "duration",
      kw: [[/\b(few weeks|weeks now|for months|months now|a long time|so long|since (last )?(sem|semester|year))\b/, 4]],
      replies: [
        "Thank you for telling me. When a feeling sticks around for weeks, it’s worth giving it proper attention, not because something is wrong with you, but because you deserve support that’s more than a chatbot.\n\nA counsellor can help you untangle it, and it’s free for students. Would you like to see the ways to reach someone?",
      ],
      actions: [tool("Show me", "help"), say("What happens in a first session?")],
    },
    {
      id: "today_only",
      kw: [[/^(just )?today\b|^only today|^since (this )?morning/, 4]],
      replies: ["Some days are just heavier, and that’s okay. Be extra kind to yourself today: one small comfort, an early night, and tomorrow is a fresh start.\n\nDid something happen today, or did it just creep up on you?"],
    },
    {
      id: "burnout",
      kw: [[/\b(burn(ed|t)? ?out|burnout|drained|overwhelm\w*|too much (work|pressure)|so much work|can'?t keep up|guilty (taking|for taking) (a )?breaks?|feel guilty resting|pressure|bahut stress|stress hai|stressed out|stress)\b/, 3]],
      replies: [
        "That sounds like a lot to carry. When demands stay high and recovery stays low for too long, even rest stops feeling restful. That’s burnout, and it’s not a personal failure.\n\nCould you pick one thing to drop, delay, or ask for help with this week? And one small thing you do purely because you enjoy it?\n\nWhat’s taking up the most of your energy right now?",
      ],
      actions: [tool("Take a breathing break", "breathe"), say("Placements and internships"), say("Too many deadlines")],
    },
    {
      id: "career",
      kw: [
        [/\b(placements?|internships?|interns?|ppos?|shortlist\w*|jobs?|careers?|resumes?|cv|interviews?|offers?|package|ctc|oa|online assessment|rejected|rejection)\b/, 3],
        [/\b(imposter|not good enough|everyone else|compar\w*|peers?|batchmates?|leetcode|coding rank|behind everyone|so behind|ahead of me|jealous|envy|their success)\b/, 3],
        [/\bfuture\b/, 1],
      ],
      replies: [
        "Placement season can make it feel like your whole worth is one number or one offer. It isn’t. Comparison is especially brutal here because you’re surrounded by talented people, and you mostly see their highlights.\n\nTry measuring yourself against who you were three months ago, not against batchmates. Rejections in this season are mostly about numbers and fit, not your value. And careers are long and winding; very few people end up where their first job pointed.\n\nWhat’s the part that’s weighing on you most?",
      ],
      actions: [tool("Reframe “I’m not good enough”", "reframe"), say("I feel like an imposter")],
    },
    {
      id: "relationships",
      kw: [[/\b(breakup|break up|broke up|girlfriend|boyfriend|gf|bf|partner|relationship|crush|situationship|friend(s)? (fight|ignor\w*)|fight\w* with (my )?(best )?friend|best friend|roommate|room ?mate|fight with|argument|betray\w*)\b/, 4]],
      replies: [
        "Relationship pain can take up so much space in your head that it’s hard to think about anything else. What you’re feeling is real, even if others say “just move on”.\n\nBe kind to yourself in the basics: sleep, food, people who feel safe. It’s okay to feel it before you fix it.\n\nDo you want to tell me a bit about what happened?",
      ],
    },
    {
      id: "family",
      kw: [[/\b(parents?|family|mom|mum|maa|dad|papa|father|mother|relatives|cousin|expectations?|disappoint\w*|ghar wale|log kya kahenge)\b/, 3], [/\bcompar\w* me\b|\bwant(s)? me to\b|\bforc\w* me\b/, 3]],
      replies: [
        "Family expectations can feel heavy, especially when you care about not letting them down. It’s possible to love your family and still feel pressured by them, and being compared to others hurts even when it’s meant well.\n\nSometimes it helps to separate what they expect from what you want, even just on paper. You don’t have to resolve it all at once.\n\nWhat do you feel they expect from you right now?",
      ],
      actions: [tool("Reframe a guilty thought", "reframe"), say("How do I talk to them about it?")],
      follow: ["That’s a lot of weight. When you do talk to them, it often goes better if you lead with what you share (“I want a good future too”) before what you want differently. Would it help to think through what you’d say?"],
    },
    {
      id: "positive",
      kw: [[/\b(happy|great day|good day|feeling good|excited|proud|got (a|an|the) (internship|job|offer|ppo)|cleared|passed|10 ?pointer|topped|won|selected|placed)\b/, 4]],
      replies: [
        "That’s wonderful, and I’m really glad you shared it. Let it land for a moment; brains under pressure tend to skip straight past good news to the next worry.\n\nWhat do you think made this happen? Noticing what worked is how you do more of it.",
      ],
      actions: [say("Give me a wellbeing tip")],
    },
    {
      id: "counselling",
      kw: [[/\b(counsel\w*|therap\w*|psycholog\w*|psychiatr\w*|professional help|talk to someone|appointment|helpline)\b/, 4]],
      replies: [
        "Reaching out to a counsellor is a strong, practical step. It doesn’t mean something is seriously wrong. People go for stress, family stuff, academics, or just to think out loud with someone trained to listen.\n\nIIT (ISM) runs a free student counselling service through the Dean of Students’ office; check the institute website or your student email for current timings. If you want to talk to someone right now, Tele-MANAS (14416) is free and open 24×7.\n\nWould it help to talk through what you might say in a first session?",
      ],
      actions: [tool("Show all helplines", "help"), say("What happens in a first session?")],
    },
    {
      id: "first_session",
      kw: [[/\b(first session|what (do|should) i say|what happens (in|at))\b/, 5]],
      replies: [
        "In a first session the counsellor will usually ask what brought you in, then mostly listen. You decide how much to share. It’s fine to start with “I’m not sure how to explain it, but I haven’t been feeling like myself.”\n\nYou can also bring notes. Some people write down two or three things they want to mention so they don’t freeze up.",
      ],
      actions: [tool("Show helplines", "help")],
    },
    {
      id: "privacy",
      kw: [[/\b(privacy|private|confidential|who can see|is this (chat )?(saved|stored|recorded)|data)\b/, 4]],
      replies: [
        "Good question. Right now Sukoon is running in demo mode: everything happens inside your browser and nothing you type is sent anywhere or saved on a server. Your reframes and theme choice are stored only on this device.\n\nIf the AI version is switched on, messages go to the server to generate replies, but the logs keep only anonymous metadata, not what you wrote.",
      ],
      actions: [tool("How Sukoon works", "about")],
    },
    {
      id: "identity",
      kw: [[/\b(are you (a )?(real|human|person|bot|ai|robot)|who (are you|made you|built you)|what are you|what can you do|how do you work|your name)\b/, 4]],
      replies: [
        "I’m Sukoon, a wellbeing companion built as a student project at IIT (ISM) Dhanbad. I’m not a person or a therapist. I’m here to listen, help you slow down, and point you to real people when you need them.\n\nYou can talk to me about stress, sleep, exams, loneliness, family, placements or hobbies, or use the tools up top: breathing, grounding and thought reframing.",
      ],
      actions: [tool("How Sukoon works", "about"), say("Exams are stressing me out"), tool("Try breathing", "breathe")],
    },
    {
      id: "offtopic",
      kw: [[/\b(explain|define|derive|solve|what is the (capital|formula|value)|code|program|algorithm|homework answer|fourier|integral|equation)\b/, 3]],
      replies: [
        "I’m not much use for academic questions, sorry. I’m built for the human side of student life. Your professors, TAs, seniors or a study group are the best bet for that.\n\nBut if studying it is stressing you out, I’m all ears. How are you feeling about it?",
      ],
    },
    {
      id: "thanks",
      kw: [[/\b(thank(s| you)|thx|ty|helped|that helps|helpful|shukriya|dhanyavaad)\b/, 4]],
      replies: [
        "I’m really glad that helped a little. Small steps count. Is there anything else you want to talk through?",
        "Thank you for taking a moment for yourself. That matters. I’m here whenever you need.",
      ],
    },
    {
      id: "bye",
      kw: [[/^(bye|goodbye|good night|gn|see you|cya|ok bye|thanks bye|talk later|ttyl)\b/, 5]],
      replies: ["Take care of yourself. Before you go: one glass of water and one slow breath out. I’m here whenever you want to come back."],
    },
    {
      id: "fine",
      kw: [[/^(i'?m |i am )?(fine|okay|ok|alright|good)\.?$/, 4]],
      replies: ["Glad to hear it. Checking in with yourself when things are okay is a good habit too. Is there anything on your mind, or would you like a quick wellbeing tip?"],
      actions: [say("Give me a wellbeing tip"), tool("1 minute of breathing", "breathe")],
    },
  ];

  const FALLBACK = [
    "I hear you. Can you tell me a little more about what that’s been like for you?",
    "That sounds like it’s been on your mind. What part of it feels the heaviest right now?",
    "Thank you for sharing that. How are you feeling about it, right in this moment?",
    "I’m with you. If it’s hard to put into words, you could start with how your body feels: tense, tired, restless?",
  ];
  const FALLBACK_ACTIONS = [say("Exams and studies"), say("Feeling low"), say("Friends and family"), tool("Just breathe", "breathe")];

  const MOOD_OPENERS = {
    calm: { text: "Glad you’re feeling okay. That’s worth noticing. Want to check in on anything, or explore what Sukoon can do?", actions: [say("Give me a wellbeing tip"), tool("Try 1 minute of breathing", "breathe"), tool("How does this work?", "about")] },
    anxious: { text: "Thanks for telling me. Anxiety can make everything feel urgent. We can slow down together first, or you can just tell me what’s going on. Whatever feels right.", actions: [tool("Breathe first", "breathe"), tool("Ground myself", "ground"), say("Exams are stressing me out")] },
    low: { text: "I’m sorry it’s a low day. You don’t need a reason, and you don’t need to explain it well. I’m here to listen.", actions: [say("I don’t know why I feel like this"), say("I feel lonely"), tool("Talk to a person", "help")] },
    overwhelmed: { text: "When everything piles up at once, it’s hard to know where to start. Let’s take one breath first. Then you can tell me what’s on the pile.", actions: [tool("One minute of breathing", "breathe"), say("I have too many deadlines"), say("Placements and internships")] },
    numb: { text: "Feeling numb or flat is more common than people talk about. It can be the mind’s way of protecting itself when things have been a lot. No pressure here. Say whatever, or nothing at all.", actions: [tool("5-4-3-2-1 grounding", "ground"), say("I’ve felt this way for weeks"), tool("Talk to a person", "help")] },
    curious: { text: "Welcome. I’m Sukoon, a small companion for IIT (ISM) students. You can talk to me about stress, sleep, loneliness, exams, hobbies, or anything else. There are also quick tools up top to breathe, ground yourself, or reframe a hard thought.", actions: [tool("How does this work?", "about"), say("Exams are stressing me out"), tool("Try the breathing tool", "breathe")] },
    none: { text: "Hey. I’m here. What’s on your mind?", actions: [say("Exams are stressing me out"), say("I feel homesick"), say("How do I talk to a counsellor?")] },
  };

  const TIPS = [
    "Here’s a small one: drink a glass of water and step outside for two minutes. Look at something far away. Your eyes and nervous system both relax when you change focal distance.",
    "Try a “done list” tonight: write three things you did today, however small. Brains under stress remember failures more than wins; this evens it out.",
    "Message one person you haven’t talked to in a while, just “thought of you”. Connection is one of the strongest protective factors for wellbeing.",
    "Protect one hour this week for something you do only for fun. Rest and play aren’t rewards for finishing work; they’re what make the work sustainable.",
    "Before bed, write tomorrow’s first task on a sticky note. It quietens the “don’t forget” loop and makes starting easier in the morning.",
  ];

  const used = {};
  function pick(id, list) {
    const i = (used[id] = ((used[id] ?? -1) + 1) % list.length);
    return list[i];
  }

  const norm = t => t.toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();
  const YES = /^(yes|yeah|yep|yup|ya|haan|han|sometimes|kind of|kinda|a bit|maybe|i think so|yes sometimes)\b/;
  const NO = /^(no|nope|nah|nahi|not really|i'?m not|never)\b/;
  const IDK = /^(idk|i don'?t know|dunno|not sure|pata nahi|no idea|hmm+|um+)\b/;
  const ACK = /^(ok|okay|k|hmm|alright|sure|fine|cool)\.?$/;

  let last = null; // last topic the companion replied with

  function score(t) {
    let best = null, bestScore = 0;
    for (const topic of T) {
      let sc = 0;
      for (const [re, w] of topic.kw) if (re.test(t)) sc += w;
      if (topic.only && sc > 0 && t.split(" ").length > 6) sc = 0.5; // a greeting at the start of a long message shouldn't win
      if (sc > bestScore) { best = topic; bestScore = sc; }
    }
    return [best, bestScore];
  }

  function reply(topic, kind = "replies") {
    last = topic;
    const list = topic[kind] && topic[kind].length ? topic[kind] : topic.replies;
    return { text: pick(topic.id + kind, list), actions: topic.actions || [], intent: topic.id };
  }

  function respond(text) {
    const t = norm(text);
    const words = t.split(" ").length;

    // Short answers to a safety question: a "yes" escalates to the safety card.
    if (last && last.ask === "safety" && words <= 6) {
      if (YES.test(t)) {
        last = null;
        return {
          escalate: true, intent: "escalate",
          text: "Thank you for trusting me with something so hard to say. You don’t have to carry this alone, and you deserve to talk to a real person right now. Please reach out to one of these; they’re free and confidential.\n\nIf you can, also tell one person near you, like a friend, roommate or warden, that you’re not okay.",
          actions: [tool("All helplines", "help"), tool("Breathe with me", "breathe"), say("I’m safe right now, I just want to keep talking")],
        };
      }
      if (NO.test(t)) return reply(T.find(x => x.id === "safe_continue"));
    }

    if (/\b(tip|advice|suggest\w*)\b/.test(t) && /\b(wellbeing|wellness|mental|tip|another)\b/.test(t)) {
      last = null;
      return { text: pick("tip", TIPS) + "\n\nWant another, or is something specific on your mind?", actions: [say("Another tip", "Give me another wellbeing tip")], intent: "tip" };
    }

    const [topic, sc] = score(t);
    // A short answer that only weakly matches another topic is probably a reply to our last question.
    if (topic && last && last.follow && words <= 5 && sc <= 3 && topic !== last) return reply(last, "follow");
    if (topic) return reply(topic);

    // No topic matched: read short replies in context of the last topic.
    if (last && words <= 8) {
      if (last.follow && !ACK.test(t)) return reply(last, "follow");
      if (IDK.test(t)) {
        return { text: "That’s okay. You don’t need to have the answer. Sometimes it helps to start with the body instead: are you feeling more tense, tired, or restless right now?", actions: [say("Tense"), say("Tired"), say("Restless")], intent: "idk" };
      }
      if (ACK.test(t) || YES.test(t) || NO.test(t)) {
        return { text: "Okay. I’m here whenever you want to keep going. You can tell me more, or try one of the tools if you’d rather not talk right now.", actions: [tool("Breathe", "breathe"), tool("Ground", "ground"), say("Give me a wellbeing tip")], intent: "ack" };
      }
    }
    if (/^(tense|restless)\b/.test(t)) return reply(T.find(x => x.id === "anxiety"));
    if (/^tired\b/.test(t)) return reply(T.find(x => x.id === "sleep"));

    last = null;
    return { text: pick("fallback", FALLBACK), actions: FALLBACK_ACTIONS, intent: "fallback" };
  }

  window.Companion = { respond, opener: m => MOOD_OPENERS[m] || MOOD_OPENERS.none, reset() { last = null; } };
})();
