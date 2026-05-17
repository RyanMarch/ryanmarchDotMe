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
        hasExtendedContent: false
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
        hasExtendedContent: false
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
        subtitle: "Local listings management product for all maps.",
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
        id: "icon-studio",
        title: "Icon Studio",
        subtitle: "A premium, web-based design toolkit for crafting custom app icons with rich gradients, skeuomorphic frames, and integrated badges.",
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
        hasExtendedContent: true
    }
    // ,
    // {
    //     id: "jeanie-end-theme",
    //     title: "Jeanie - 'End Theme'",
    //     subtitle: "Music Video",
    //     tags: [
    //         { label: "Archive", color: "gray" }
    //     ],
    //     featured: false,
    //     size: "medium",
    //     image: "",
    //     imageClass: "destination-icon",
    //     actionText: "View Project",
    //     actionUrl: "",
    //     hasExtendedContent: true
    // },
    // {
    //     id: "night-riots-interview",
    //     title: "Night Riots Interview",
    //     subtitle: "Interview & Podcast",
    //     tags: [
    //         { label: "Archive", color: "gray" }
    //     ],
    //     featured: false,
    //     size: "medium",
    //     image: "",
    //     imageClass: "destination-icon",
    //     actionText: "View Project",
    //     actionUrl: "",
    //     hasExtendedContent: true
    // },
    // {
    //     id: "breaking-winter",
    //     title: "Breaking Winter",
    //     subtitle: "Original Composition",
    //     tags: [
    //         { label: "Archive", color: "gray" }
    //     ],
    //     featured: false,
    //     size: "medium",
    //     image: "",
    //     imageClass: "destination-icon",
    //     actionText: "View Project",
    //     actionUrl: "",
    //     hasExtendedContent: true
    // },
    // {
    //     id: "the-danger-ranger",
    //     title: "The Danger Ranger",
    //     subtitle: "A Foul-Mouthed Truck Review",
    //     tags: [
    //         { label: "Archive", color: "gray" }
    //     ],
    //     featured: false,
    //     size: "medium",
    //     image: "",
    //     imageClass: "destination-icon",
    //     actionText: "View Project",
    //     actionUrl: "",
    //     hasExtendedContent: true
    // },
    // {
    //     id: "taylor-swift-analysis-hour",
    //     title: "Taylor Swift Analysis Hour",
    //     subtitle: "Podcast",
    //     tags: [
    //         { label: "Archive", color: "gray" }
    //     ],
    //     featured: false,
    //     size: "medium",
    //     image: "",
    //     imageClass: "destination-icon",
    //     actionText: "View Project",
    //     actionUrl: "",
    //     hasExtendedContent: true
    // },
    // {
    //     id: "sbut-feel-right",
    //     title: "Sbut - 'Feel Right'",
    //     subtitle: "Cover",
    //     tags: [
    //         { label: "Archive", color: "gray" }
    //     ],
    //     featured: false,
    //     size: "medium",
    //     image: "",
    //     imageClass: "destination-icon",
    //     actionText: "View Project",
    //     actionUrl: "",
    //     hasExtendedContent: true
    // },
    // {
    //     id: "forecast-weather",
    //     title: "Forecast Weather",
    //     subtitle: "Windows App",
    //     tags: [
    //         { label: "Archive", color: "gray" }
    //     ],
    //     featured: false,
    //     size: "medium",
    //     image: "",
    //     imageClass: "destination-icon",
    //     actionText: "View Project",
    //     actionUrl: "",
    //     hasExtendedContent: true
    // },
    // {
    //     id: "nonstop-megakill-deathblood-slaughterfest-facemelter-20-two-point-oh",
    //     title: "Nonstop Megakill Deathblood Slaughterfest Facemelter 2.0 (TWO POINT OH)",
    //     subtitle: "Radio Sweeper",
    //     tags: [
    //         { label: "Archive", color: "gray" }
    //     ],
    //     featured: false,
    //     size: "medium",
    //     image: "",
    //     imageClass: "destination-icon",
    //     actionText: "View Project",
    //     actionUrl: "",
    //     hasExtendedContent: true
    // },
    // {
    //     id: "making-of-a-masterpiece",
    //     title: "Making of A Masterpiece",
    //     subtitle: "Mockumentary",
    //     tags: [
    //         { label: "Archive", color: "gray" }
    //     ],
    //     featured: false,
    //     size: "medium",
    //     image: "",
    //     imageClass: "destination-icon",
    //     actionText: "View Project",
    //     actionUrl: "",
    //     hasExtendedContent: true
    // },
    // {
    //     id: "wxcu-radio",
    //     title: "WXCU Radio",
    //     subtitle: "Radio Station",
    //     tags: [
    //         { label: "Archive", color: "gray" }
    //     ],
    //     featured: false,
    //     size: "medium",
    //     image: "",
    //     imageClass: "destination-icon",
    //     actionText: "View Project",
    //     actionUrl: "",
    //     hasExtendedContent: true
    // },
    // {
    //     id: "chris-jamison-unaware",
    //     title: "Chris Jamison - 'Unaware'",
    //     subtitle: "Cover",
    //     tags: [
    //         { label: "Archive", color: "gray" }
    //     ],
    //     featured: false,
    //     size: "medium",
    //     image: "",
    //     imageClass: "destination-icon",
    //     actionText: "View Project",
    //     actionUrl: "",
    //     hasExtendedContent: true
    // },
    // {
    //     id: "chris-jamison-treasure",
    //     title: "Chris Jamison - 'Treasure'",
    //     subtitle: "Cover",
    //     tags: [
    //         { label: "Archive", color: "gray" }
    //     ],
    //     featured: false,
    //     size: "medium",
    //     image: "",
    //     imageClass: "destination-icon",
    //     actionText: "View Project",
    //     actionUrl: "",
    //     hasExtendedContent: true
    // },
    // {
    //     id: "fesss-mess-paris",
    //     title: "Fess's Mess - Paris",
    //     subtitle: "Cover",
    //     tags: [
    //         { label: "Archive", color: "gray" }
    //     ],
    //     featured: false,
    //     size: "medium",
    //     image: "",
    //     imageClass: "destination-icon",
    //     actionText: "View Project",
    //     actionUrl: "",
    //     hasExtendedContent: true
    // },
    // {
    //     id: "furniture-bank-promo",
    //     title: "Furniture Bank Promo",
    //     subtitle: "Non-Profit Promo",
    //     tags: [
    //         { label: "Archive", color: "gray" }
    //     ],
    //     featured: false,
    //     size: "medium",
    //     image: "",
    //     imageClass: "destination-icon",
    //     actionText: "View Project",
    //     actionUrl: "",
    //     hasExtendedContent: true
    // }
];
