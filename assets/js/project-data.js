const myProjects = [
    {
        id: "motion-poster",
        title: "Motion Poster",
        subtitle: "Atmospheric, living digital centerpieces bring immersive art to high-end events and venues. Now with multiple themes.",
        tags: [
            { label: "Recently Updated", color: "gold" },
            { label: "Digital Signage", color: "purple" },
            { label: "Project", color: "gray" }
        ],
        featured: true,
        size: "large",
        image: "assets/img/motion-poster-framed.png",
        imageClass: "poster-preview-img",
        actionText: "Launch Motion Poster",
        actionUrl: "https://motionposter.ryanmarch.me",
        sourceUrl: "https://github.com/RyanMarch/motionEventPoster",
        hasExtendedContent: true,
        showLaunchButton: true
    },
    {
        id: "bowserstack",
        title: "Bowserstack",
        subtitle: "An interactive Bowserstack testing tool to help get to the bottom of web-based issues.",
        tags: [
            { label: "Completed", color: "green" },
            { label: "Experimentation", color: "pink" },
            { label: "Project", color: "gray" }
        ],
        featured: false,
        size: "medium",
        image: "assets/img/bowser-icon.png",
        imageClass: "bowser-preview-img",
        actionText: "Launch Bowserstack",
        actionUrl: "https://bowserstack.ryanmarch.me",
        sourceUrl: "https://github.com/RyanMarch/bowserstack",
        hasExtendedContent: false,
        showLaunchButton: true
    },
    {
        id: "rentpress",
        title: "RentPress for Apartments",
        subtitle: "A comprehensive property management and marketing solution to build the ultimate online leasing office.",
        tags: [
            { label: "Professional", color: "blue" },
            { label: "Platform", color: "purple" },
            { label: "Real Estate", color: "teal", priority: "low" }
        ],
        featured: false,
        size: "large",
        image: "content/rentpress/images/floor-plan-grid.webp",
        imageClass: "destination-icon",
        actionText: "Visit RentPress.io",
        actionUrl: "https://rentpress.io",
        sourceUrl: "https://wordpress.org/plugins/rentpress-for-websites/",
        hasExtendedContent: true
    },
    {
        id: "rentpress-local",
        title: "RentPress Local",
        subtitle: "Local listings management product for automatic map updates.",
        tags: [
            { label: "Professional", color: "blue" },
            { label: "Real Estate", color: "teal", priority: "low" },
            { label: "Product", color: "gray" }
        ],
        featured: false,
        size: "tall",
        image: "content/rentpress-local/images/rentpress-page-schema-phones-double.png",
        imageClass: "destination-icon",
        actionText: "Visit RentPress Local",
        actionUrl: "https://rentpress.io/local/",
        hasExtendedContent: true
    },
    {
        id: "rentpress-lead-sync",
        title: "RentPress Lead Sync",
        subtitle: "Send and receive leads without writing code.",
        tags: [
            { label: "Professional", color: "blue" },
            { label: "Real Estate", color: "teal", priority: "low" },
            { label: "Product", color: "gray" }
        ],
        featured: false,
        size: "tall",
        image: "content/rentpress-lead-sync/images/lead-sync-icon.png",
        imageClass: "destination-icon",
        actionText: "View Plugin",
        actionUrl: "https://wordpress.org/plugins/rentpress-gravity-forms-add-on/",
        sourceUrl: "https://support.30lines.com/documentation/rentpress-gravity-forms-add-on/",
        hasExtendedContent: true
    },
    {
        id: "icon-studio",
        title: "Icon Studio",
        subtitle: "A web-based design toolkit for crafting custom icons with custom photos, gradients, frames, and badges.",
        tags: [
            { label: "Recently Updated", color: "gold" },
            { label: "Design Tool", color: "purple" },
            { label: "Project", color: "gray" }
        ],
        featured: false,
        size: "large",
        image: "assets/img/icon-studio-multi-theme-framed.png",
        imageClass: "destination-icon",
        actionText: "Launch Icon Studio",
        actionUrl: "https://iconstudio.ryanmarch.me",
        sourceUrl: "https://github.com/RyanMarch/iconStudio",
        hasExtendedContent: true,
        showLaunchButton: true
    },
    {
        id: "rentpress-data-hub",
        title: "RentPress Data Hub",
        subtitle: "The centralized data engine bridging the gap between property management APIs and modern marketing platforms.",
        tags: [
            { label: "Professional", color: "blue" },
            { label: "Real Estate", color: "teal", priority: "low" },
            { label: "Backend", color: "purple" }
        ],
        featured: false,
        size: "large",
        image: "",
        symbol: "hub",
        imageClass: "destination-icon",
        actionText: "Learn More",
        actionUrl: "",
        hasExtendedContent: true
    },
    {
        id: "amenities-manager",
        title: "Amenities Manager",
        subtitle: "Powerful control over property amenities and features for multifamily websites.",
        tags: [
            { label: "Professional", color: "blue" },
            { label: "Real Estate", color: "teal", priority: "low" },
            { label: "Add-On", color: "gray" },
        ],
        featured: false,
        size: "medium",
        image: "content/amenities-manager/images/amenities-icon.png",
        imageClass: "destination-icon",
        actionText: "View Plugin",
        actionUrl: "https://wordpress.org/plugins/rentpress-amenities-manager-add-on/",
        sourceUrl: "https://support.30lines.com/documentation/rentpress-amenities-manager-add-on/",
        hasExtendedContent: true
    },
    {
        id: "rentpress-email",
        title: "RentPress Email",
        subtitle: "Automated lifecycle marketing that transforms property management data into personalized resident journeys.",
        tags: [
            { label: "Professional", color: "blue" },
            { label: "Real Estate", color: "teal", priority: "low" },
            { label: "Product", color: "gray" }
        ],
        featured: false,
        size: "medium",
        image: "content/rentpress-email/images/rentpress-email-icon.png",
        symbol: "email",
        imageClass: "destination-icon",
        actionText: "Learn More",
        actionUrl: "",
        hasExtendedContent: true
    },
    {
        id: "night-riots-interview",
        title: "Night Riots Interview",
        subtitle: "An exclusive on-tour artist interview broadcast on WXCU Radio.",
        tags: [
            { label: "Audio Production", color: "blue" },
            { label: "Interview", color: "cyan" },
            { label: "Radio", color: "purple" },
            { label: "Podcast", color: "gold", priority: "low" },
            { label: "Archive", color: "gray", priority: "low" }
        ],
        featured: false,
        size: "medium",
        image: "content/night-riots-interview/images/nightRiots.jpg",
        imageClass: "destination-icon",
        actionText: "View Interview",
        actionUrl: "",
        hasExtendedContent: true
    },
    {
        id: "breaking-winter",
        title: "Breaking Winter",
        subtitle: "Original Composition",
        tags: [
            { label: "Audio Production", color: "blue" },
            { label: "Composition", color: "purple" },
            { label: "Archive", color: "gray", priority: "low" }
        ],
        featured: false,
        size: "small",
        image: "content/breaking-winter/images/bw.jpg",
        imageClass: "destination-icon",
        actionText: "View Project",
        actionUrl: "",
        hasExtendedContent: true
    },
    {
        id: "wxcu-radio",
        title: "WXCU Radio",
        subtitle: "Broadcasting, branding, and WordPress web development for Capital University's student radio station.",
        tags: [
            { label: "Web Development", color: "green" },
            { label: "Audio Production", color: "blue" },
            { label: "Branding", color: "purple", priority: "low" },
            { label: "Marketing", color: "orange" },
            { label: "Archive", color: "gray", priority: "low" }
        ],
        featured: false,
        size: "large",
        image: "content/wxcu-radio/images/wxcuStreamingLive.jpg",
        imageClass: "destination-icon",
        actionText: "View Case Study",
        actionUrl: "",
        hasExtendedContent: true
    },
    {
        id: "forecast-weather",
        title: "Forecast Weather",
        subtitle: "Get the seven day forecast for an entered location.",
        tags: [
            { label: "App", color: "green" },
            { label: "Award-Winning", color: "gold" },
            { label: "Archive", color: "gray" },
            { label: "Hackathon", color: "purple", priority: "low" },

        ],
        featured: false,
        size: "tall",
        image: "content/forecast-weather/images/icon.webp",
        imageClass: "destination-icon",
        actionText: "View Project",
        actionUrl: "https://web.archive.org/web/20150715014523/http://apps.microsoft.com/windows/en-us/app/forecast-weather/de8bdabd-1707-4512-9866-f1c3c0652914",
        hasExtendedContent: true
    },
    {
        id: "the-danger-ranger",
        title: "The Danger Ranger",
        subtitle: "A satirical truck review with comedic timing and unexpected turns.",
        tags: [
            { label: "Video Production", color: "rose" },
            { label: "Comedy", color: "gold" },
            { label: "Archive", color: "gray", priority: "low" }
        ],
        featured: false,
        size: "medium",
        image: "content/the-danger-ranger/images/dangerRanger.jpg",
        imageClass: "destination-icon",
        actionText: "View Film",
        actionUrl: "",
        hasExtendedContent: true
    },
    {
        id: "jeanie-end-theme",
        title: "Jeanie - 'End Theme'",
        subtitle: "A highly atmospheric, stylized indie music video with custom digital lighting effects.",
        tags: [
            { label: "Video Production", color: "rose" },
            { label: "Archive", color: "gray", priority: "low" }
        ],
        featured: false,
        size: "medium",
        image: "content/jeanie-end-theme/images/endThemePoster.jpg",
        imageClass: "destination-icon",
        actionText: "View Music Video",
        actionUrl: "",
        hasExtendedContent: true
    },
    {
        id: "taylor-swift-analysis-hour",
        title: "Taylor Swift Analysis Hour",
        subtitle: "A dynamic pop music songwriting and marketing analysis podcast segment.",
        tags: [
            { label: "Audio Production", color: "blue" },
            { label: "Podcast", color: "gold" },
            { label: "Archive", color: "gray", priority: "low" }
        ],
        featured: false,
        size: "medium",
        image: "content/taylor-swift-analysis-hour/images/taylorHero.jpg",
        imageClass: "destination-icon",
        actionText: "View Podcast",
        actionUrl: "",
        hasExtendedContent: true
    },
    {
        id: "sbut-feel-right",
        title: "Sbut - 'Feel Right'",
        subtitle: "Recording & producing a cover of Mark Ronson & Mystikal's song.",
        tags: [
            { label: "Audio Production", color: "blue" },
            { label: "Archive", color: "gray", priority: "low" }
        ],
        featured: false,
        size: "medium",
        image: "content/sbut-feel-right/images/feelright.jpg",
        imageClass: "destination-icon",
        actionText: "View Project",
        actionUrl: "",
        hasExtendedContent: true
    },
    {
        id: "music-festival-radio-spot",
        title: "Music Festival Radio Spot",
        subtitle: "Radio sweeper for an extremely loud concert.",
        tags: [
            { label: "Audio Production", color: "blue" },
            { label: "Marketing", color: "orange" },
            { label: "Archive", color: "gray", priority: "low" },
        ],
        featured: false,
        size: "small",
        image: "content/music-festival-radio-spot/images/radio-sweeper-artwork.jpg",
        imageClass: "destination-icon",
        actionText: "View Project",
        actionUrl: "",
        hasExtendedContent: true
    },
    {
        id: "making-of-a-masterpiece",
        title: "Making of A Masterpiece",
        subtitle: "A mockumentary short film produced in 24 hours.",
        tags: [
            { label: "Video Production", color: "rose" },
            { label: "Award-Winning", color: "gold" },
            { label: "Archive", color: "gray", priority: "low" }
        ],
        featured: false,
        size: "medium",
        image: "content/making-of-a-masterpiece/images/masterpieceTitleCard.jpg",
        imageClass: "destination-icon",
        actionText: "View Project",
        actionUrl: "",
        hasExtendedContent: true
    },
    {
        id: "chris-jamison-covers",
        title: "Chris Jamison Covers",
        subtitle: "A series of high-fidelity studio cover recordings and multitrack mixes.",
        tags: [
            { label: "Audio Production", color: "blue" },
            { label: "Mixing", color: "indigo" },
            { label: "Archive", color: "gray", priority: "low" }
        ],
        featured: false,
        size: "medium",
        image: "content/chris-jamison-covers/images/chris-jamison-covers.jpg",
        imageClass: "destination-icon",
        actionText: "View Covers",
        actionUrl: "",
        hasExtendedContent: true
    },
    {
        id: "fesss-mess-paris",
        title: "Fess's Mess - 'Paris'",
        subtitle: "Recording and mixing of Grace Potter's hit song.",
        tags: [
            { label: "Audio Production", color: "blue" },
            { label: "Mixing", color: "indigo" },
            { label: "Archive", color: "gray", priority: "low" }
        ],
        featured: false,
        size: "small",
        image: "content/fesss-mess-paris/images/paris.jpg",
        imageClass: "destination-icon",
        actionText: "View Cover",
        actionUrl: "",
        hasExtendedContent: true
    },
    {
        id: "furniture-bank-promo",
        title: "Furniture Bank Promo",
        subtitle: "A documentary-style volunteer recruitment video detailing local community impact.",
        tags: [
            { label: "Video Production", color: "rose" },
            { label: "Non-Profit", color: "teal" },
            { label: "Archive", color: "gray", priority: "low" }
        ],
        featured: false,
        size: "medium",
        image: "content/furniture-bank-promo/images/furniture-bank.jpg",
        imageClass: "destination-icon",
        actionText: "View Promo",
        actionUrl: "",
        hasExtendedContent: true
    }
];
