import{myProjects as D}from"./project-data.js?v=1";

function R(k){
    k.querySelectorAll(".custom-audio-player").forEach(n=>{
        const p=n.querySelector("audio");
        if(!p)return;
        const v=p.getAttribute("src"),
              z=n.getAttribute("data-title")||"Audio Track",
              V=n.getAttribute("data-subtitle")||"Local File";
        n.innerHTML=`
            <audio src="${v}" preload="metadata"></audio>
            
            <!-- Top Row: Title & Info -->
            <div class="player-header">
                <span class="player-title">${z}</span>
                <span class="player-subtitle">${V}</span>
            </div>
            
            <!-- Middle Row: Timeline Scrubber -->
            <div class="player-timeline">
                <span class="player-time-current">0:00</span>
                <div class="player-progress-container" aria-label="Seek track" role="slider" tabindex="0" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
                    <div class="player-progress-bar"></div>
                    <div class="player-progress-knob"></div>
                </div>
                <span class="player-time-duration">0:00</span>
            </div>
            
            <!-- Bottom Row: Controls -->
            <div class="player-controls">
                <!-- Volume Control -->
                <div class="player-volume-group">
                    <button class="player-mute" aria-label="Mute">
                        <svg class="icon-volume" viewBox="0 0 24 24"><path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                        <svg class="icon-muted" viewBox="0 0 24 24" style="display:none;"><path fill="currentColor" d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.21.05-.42.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
                    </button>
                    <div class="player-volume-slider-container" aria-label="Volume slider" role="slider" tabindex="0" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100">
                        <div class="player-volume-slider-bar" style="width: 100%;"></div>
                    </div>
                </div>

                <!-- Play/Pause Button -->
                <button class="player-play-pause" aria-label="Play">
                    <svg class="icon-play" viewBox="0 0 24 24"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
                    <svg class="icon-pause" viewBox="0 0 24 24" style="display:none;"><path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                </button>

                <!-- Right spacer to balance symmetry -->
                <div class="player-right-spacer"></div>
            </div>
        `;
        const o=n.querySelector("audio"),
              E=n.querySelector(".player-play-pause"),
              m=n.querySelector(".icon-play"),
              $=n.querySelector(".icon-pause"),
              y=n.querySelector(".player-progress-container"),
              L=n.querySelector(".player-progress-bar"),
              x=n.querySelector(".player-progress-knob"),
              C=n.querySelector(".player-time-current"),
              M=n.querySelector(".player-time-duration"),
              h=n.querySelector(".player-mute"),
              g=n.querySelector(".icon-volume"),
              b=n.querySelector(".icon-muted"),
              i=n.querySelector(".player-volume-slider-container"),
              e=n.querySelector(".player-volume-slider-bar");
        if(!o||!E)return;
        function a(t){
            if(isNaN(t)||!isFinite(t))return"0:00";
            const s=Math.floor(t/60),l=Math.floor(t%60);
            return`${s}:${l<10?"0":""}${l}`
        }
        E.addEventListener("click",()=>{
            document.querySelectorAll("audio").forEach(t=>{t!==o&&!t.paused&&t.pause()}),
            o.paused?o.play().catch(t=>console.error("Play failed:",t)):o.pause()
        }),
        o.addEventListener("play",()=>{
            m&&(m.style.display="none"),$&&($.style.display="block"),E.setAttribute("aria-label","Pause")
        }),
        o.addEventListener("pause",()=>{
            m&&(m.style.display="block"),$&&($.style.display="none"),E.setAttribute("aria-label","Play")
        }),
        o.addEventListener("ended",()=>{
            m&&(m.style.display="block"),$&&($.style.display="none"),L&&(L.style.width="0%"),x&&(x.style.left="0%"),y&&(y.style.setProperty("--progress-percent","0%"),y.setAttribute("aria-valuenow","0")),C&&(C.textContent="0:00"),E.setAttribute("aria-label","Play")
        }),
        o.addEventListener("timeupdate",()=>{
            const t=o.currentTime,s=o.duration;
            if(s&&!isNaN(s)&&isFinite(s)){
                const l=t/s*100;
                L&&(L.style.width=`${l}%`),x&&(x.style.left=`${l}%`),y&&(y.style.setProperty("--progress-percent",`${l}%`),y.setAttribute("aria-valuenow",Math.round(l).toString())),M&&(M.textContent=a(s))
            }
            C&&(C.textContent=a(t))
        });
        const r=()=>{
            M&&o.duration&&!isNaN(o.duration)&&isFinite(o.duration)&&(M.textContent=a(o.duration))
        };
        if(o.readyState>=1?r():o.addEventListener("loadedmetadata",r),o.addEventListener("durationchange",r),y){
            y.addEventListener("click",t=>{
                const s=y.getBoundingClientRect(),l=t.clientX-s.left,u=s.width,c=Math.min(Math.max(l/u,0),1);
                o.duration&&!isNaN(o.duration)&&isFinite(o.duration)&&(o.currentTime=c*o.duration,L&&(L.style.width=`${c*100}%`),x&&(x.style.left=`${c*100}%`))
            }),
            y.addEventListener("keydown",t=>{
                t.key==="ArrowRight"||t.key==="ArrowUp"?(t.preventDefault(),o.duration&&!isNaN(o.duration)&&isFinite(o.duration)&&(o.currentTime=Math.min(o.currentTime+5,o.duration))):t.key==="ArrowLeft"||t.key==="ArrowDown"?(t.preventDefault(),o.currentTime=Math.max(o.currentTime-5,0)):t.key==="Home"?(t.preventDefault(),o.currentTime=0):t.key==="End"&&(t.preventDefault(),o.duration&&!isNaN(o.duration)&&isFinite(o.duration)&&(o.currentTime=o.duration))
            })
        }
        h&&h.addEventListener("click",()=>{
            o.muted=!o.muted,
            o.muted?(g&&(g.style.display="none"),b&&(b.style.display="block"),e&&(e.style.width="0%"),i.setAttribute("aria-valuenow","0"),h.setAttribute("aria-label","Unmute")):(g&&(g.style.display="block"),b&&(b.style.display="none"),e&&(e.style.width=`${o.volume*100}%`),i.setAttribute("aria-valuenow",Math.round(o.volume*100).toString()),h.setAttribute("aria-label","Mute"))
        }),
        i&&(t=>{
            const s=l=>{
                o.volume=l,
                e&&(e.style.width=`${l*100}%`),
                i.setAttribute("aria-valuenow",Math.round(l*100).toString()),
                l===0?(o.muted=!0,g&&(g.style.display="none"),b&&(b.style.display="block"),h.setAttribute("aria-label","Unmute")):(o.muted=!1,g&&(g.style.display="block"),b&&(b.style.display="none"),h.setAttribute("aria-label","Mute"))
            };
            i.addEventListener("click",l=>{
                const u=i.getBoundingClientRect(),c=l.clientX-u.left,q=u.width,oVal=Math.min(Math.max(c/q,0),1);
                s(oVal)
            }),
            i.addEventListener("keydown",l=>{
                l.key==="ArrowRight"||l.key==="ArrowUp"?(l.preventDefault(),s(Math.min(o.volume+.05,1))):l.key==="ArrowLeft"||l.key==="ArrowDown"?(l.preventDefault(),s(Math.max(o.volume-.05,0))):l.key==="Home"?(l.preventDefault(),s(0)):l.key==="End"&&(l.preventDefault(),s(1))
            })
        })()
    })
}

function initClearTechBrochure(container) {
    const tabs = container.querySelectorAll(".brochure-tab-btn");
    const panels = container.querySelectorAll(".brochure-view-panel");

    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            tabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");

            const targetView = tab.getAttribute("data-view");
            panels.forEach(panel => {
                panel.style.display = (panel.id === `panel-${targetView}`) ? "block" : "none";
            });
        });
    });
}

document.addEventListener("DOMContentLoaded",()=>{
    const k=document.getElementById("projects-grid"),
          kArchive=document.getElementById("archive-projects-grid"),
          archiveDivider=document.getElementById("archive-divider"),
          d=document.getElementById("project-detail-area");
          
    let n=document.getElementById("lightbox-overlay");
    n||(n=document.createElement("div"),n.id="lightbox-overlay",n.className="lightbox-overlay",n.setAttribute("aria-hidden","true"),n.setAttribute("tabindex","-1"),n.setAttribute("role","dialog"),n.setAttribute("aria-modal","true"),n.setAttribute("aria-label","Image gallery lightbox"),n.innerHTML=`
            <button class="lightbox-close" aria-label="Close lightbox">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            <div class="lightbox-container">
                <img id="lightbox-image" src="" alt="Enlarged view">
                <p id="lightbox-caption" class="lightbox-caption"></p>
            </div>
        `,document.body.appendChild(n)),
    n.addEventListener("keydown",i=>{
        if(i.key==="Tab"){
            const e=n.querySelectorAll('button, [tabindex="0"], iframe');
            if(e.length===0)return;
            const a=e[0],r=e[e.length-1];
            i.shiftKey?document.activeElement===a&&(r.focus(),i.preventDefault()):document.activeElement===r&&(a.focus(),i.preventDefault())
        }
    });
    
    const p=document.getElementById("lightbox-image"),
          v=document.getElementById("lightbox-caption"),
          z=n.querySelector(".lightbox-close"),
          V=[
              {id:"all",label:"All",match:i=>!0},
              {id:"professional",label:"Professional",match:i=>i.tags.some(e=>["professional","platform","real estate"].includes(e.label.toLowerCase()))},
              {id:"web-apps",label:"Web & Apps",match:i=>i.tags.some(e=>["web development","design tool","app","platform","digital signage","backend","experimentation","analytics"].includes(e.label.toLowerCase()))},
              {id:"audio-music",label:"Audio & Music",match:i=>i.tags.some(e=>["audio production","composition","radio","podcast","mixing"].includes(e.label.toLowerCase()))},
              {id:"video-film",label:"Video & Film",match:i=>i.tags.some(e=>["video production","comedy"].includes(e.label.toLowerCase()))},
              {id:"archive",label:"Archive",match:i=>i.tags.some(e=>e.label.toLowerCase()==="archive")}
          ];
          
    V.forEach(i=>{i.count=D.filter(e=>i.match(e)).length});
    
    if(k){
        const i=document.getElementById("filter-pills");
        if(i){
            V.forEach(a=>{
                const r=document.createElement("button");
                r.className=`filter-pill${a.id==="all"?" active":""}`,
                r.setAttribute("data-category",a.id),
                r.setAttribute("aria-pressed",a.id==="all"?"true":"false"),
                r.innerHTML=`${a.label}`,
                r.addEventListener("click",()=>{
                    if(r.classList.contains("active")){
                        if(a.id==="all")return;
                        r.classList.remove("active"),r.setAttribute("aria-pressed","false");
                        const t=i.querySelector('.filter-pill[data-category="all"]');
                        t&&(t.classList.add("active"),t.setAttribute("aria-pressed","true")),
                        E("all");
                        return
                    }
                    i.querySelectorAll(".filter-pill").forEach(t=>{
                        t.classList.remove("active"),t.setAttribute("aria-pressed","false")
                    }),
                    r.classList.add("active"),
                    r.setAttribute("aria-pressed","true"),
                    E(a.id)
                }),
                i.appendChild(r)
            });
            const e=()=>{
                const a=i.scrollLeft,r=i.scrollWidth-i.clientWidth;
                requestAnimationFrame(()=>{
                    a>2?i.classList.add("scrolled-left"):i.classList.remove("scrolled-left"),
                    a<r-2?i.classList.add("scrolled-right"):i.classList.remove("scrolled-right")
                })
            };
            i.addEventListener("scroll",e),
            setTimeout(e,50),
            window.addEventListener("resize",e)
        }
        
        D.forEach(e=>{
            const a=document.createElement("div"),
                  r=e.size?`size-${e.size}`:"size-medium";
            a.className=`glimmer-card destination-card ${r} ${e.featured?"featured":""}`;
            const t=V.filter(c=>c.match(e)).map(c=>c.id);
            a.setAttribute("data-categories",t.join(" "));
            const s=o(e.tags);
            let l="";
            e.showLaunchButton&&e.hasExtendedContent?l=`
                <a href="${e.actionUrl}" class="project-btn" target="_blank" rel="noopener noreferrer">
                    <span>${e.actionText}</span>
                    <svg class="btn-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42L17.59 5H14V3zM19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2 2v-7h-2v7z"/></svg>
                </a>
                <a href="/project/${e.id}/" class="project-btn btn-secondary read-more-btn" data-project-id="${e.id}">
                    <span>Read More <span class="sr-only">about ${e.title}</span></span>
                    <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                </a>
            `:e.hasExtendedContent?l=`
                <a href="/project/${e.id}/" class="project-btn read-more-btn" data-project-id="${e.id}">
                    <span>Read More <span class="sr-only">about ${e.title}</span></span>
                    <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                </a>
            `:e.actionUrl&&(l=`
                <a href="${e.actionUrl}" class="project-btn" target="_blank" rel="noopener noreferrer">
                    <span>${e.actionText}</span>
                    <svg class="btn-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42L17.59 5H14V3zM19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2 2v-7h-2v7z"/></svg>
                </a>
            `);
            let u="";
            if(e.image){
                const c=e.imageWidth?` width="${e.imageWidth}"`:"",
                      q=e.imageHeight?` height="${e.imageHeight}"`:"",
                      H=e.featured?'loading="eager" fetchpriority="high"':'loading="lazy"';
                let I="",A="";
                const S=e.image.lastIndexOf(".");
                if(S!==-1&&(e.id==="icon-studio"||e.id==="motion-poster"||e.id==="bowserstack"||e.id==="rentpress"||e.id==="aasc-analytics")){
                    const _=e.image.substring(0,S),
                          P=e.image.substring(S),
                          f=e.id==="aasc-analytics"?"-small":"-sm",
                          w=`${_}${f}${P}`;
                    let B=e.imageWidth,T=Math.round(e.imageWidth/2);
                    e.id==="icon-studio"?(B=800,T=400):e.id==="motion-poster"?(B=1e3,T=600):e.id==="bowserstack"?(B=480,T=300):e.id==="rentpress"?(B=800,T=485):e.id==="aasc-analytics"&&(B=1920,T=800),
                    I=` srcset="${w} ${T}w, ${e.image} ${B}w"`,
                    A=` sizes="(max-width: 700px) 90vw, (max-width: 1050px) 45vw, ${e.size==="large"?"500px":"300px"}"`
                }
                u=`<img id="project-image-${e.id}" src="${e.image}"${I}${A} alt="${e.title} Preview" ${H}${c}${q} class="${e.featured?"destination-image-standalone":"destination-icon"} ${e.imageClass}">`
            }else{
                let c="";
                e.symbol==="data"?c='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0v3.75" /></svg>':e.symbol==="hub"?c='<img src="assets/img/rentpress-logo.svg" alt="RentPress" width="376" height="69">':e.symbol==="email"?c='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" /></svg>':c='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" /></svg>',
                u=`<div class="project-placeholder-icon${e.symbol==="hub"?" hub-motif":""}">${c}</div>`
            }
            a.innerHTML=`
                <div class="tag-list">
                    ${s}
                </div>
                <div class="destination-content">
                    <div class="destination-header">
                        <h2>${e.title}</h2>
                    </div>
                    <p>${e.subtitle}</p>
                    <div class="destination-actions">
                        ${l}
                    </div>
                </div>
                <div class="${e.featured?"destination-standalone-visual":"destination-visual"}">
                     ${u}
                </div>
            `;
            
            const isArchived = e.tags.some(tag => tag.label.toLowerCase() === "archive");
            if (isArchived && kArchive) {
                kArchive.appendChild(a);
            } else {
                k.appendChild(a);
            }
        });
        
        // Initial setup for displays
        const showActive = k && k.querySelectorAll(".destination-card").length > 0;
        const showArchive = kArchive && kArchive.querySelectorAll(".destination-card").length > 0;
        if (k) k.style.display = showActive ? "grid" : "none";
        if (kArchive) kArchive.style.display = showArchive ? "grid" : "none";
        if (archiveDivider) archiveDivider.style.display = (showActive && showArchive) ? "flex" : "none";
    }
    
    function o(i){
        return!i||i.length===0?"":i.map(e=>{
            const a=e.priority?` tag-priority-${e.priority}`:"";
            return`<span class="tag ${e.color?`tag-${e.color.toLowerCase()}`:"tag-gray"}${a}">${e.label}</span>`
        }).join("")
    }
    
    function E(i){
        const e=document.querySelectorAll(".destination-card"),
              a=k.getBoundingClientRect().height,
              aArchive=kArchive ? kArchive.getBoundingClientRect().height : 0;
              
        k.style.minHeight=`${a}px`;
        if(kArchive) kArchive.style.minHeight=`${aArchive}px`;
        
        const r=new Map;
        e.forEach(t=>{
            if(!t.classList.contains("filtered-out")){
                const l=t.getBoundingClientRect();
                r.set(t,{top:l.top,left:l.left,wasVisible:!0})
            }else r.set(t,{wasVisible:!1})
        });
        
        e.forEach(t=>{
            t.getAttribute("data-categories").split(" ").includes(i)
            ? t.classList.contains("filtered-out")&&(t.classList.remove("filtered-out"),t.style.display="")
            : (t.classList.add("filtered-out"),t.style.display="none")
        });
        
        // Update layouts of grid containers & divider immediately so FLIP measures final layout positions
        let hasActive = false;
        let hasArchive = false;
        if (k) {
            hasActive = Array.from(k.querySelectorAll(".destination-card")).some(card => !card.classList.contains("filtered-out"));
            k.style.display = hasActive ? "grid" : "none";
        }
        if (kArchive) {
            hasArchive = Array.from(kArchive.querySelectorAll(".destination-card")).some(card => !card.classList.contains("filtered-out"));
            kArchive.style.display = hasArchive ? "grid" : "none";
        }
        if (archiveDivider) {
            archiveDivider.style.display = (hasActive && hasArchive) ? "flex" : "none";
        }
        
        requestAnimationFrame(()=>{
            e.forEach(t=>{
                const s=r.get(t);
                if(t.classList.contains("filtered-out"))return;
                const l=t.getBoundingClientRect();
                if(s.wasVisible){
                    const u=s.left-l.left,c=s.top-l.top;
                    (u!==0||c!==0)&&(t.style.transform=`translate(${u}px, ${c}px)`,t.style.transition="none")
                }else t.style.opacity="0",t.style.transform="scale(0.9) translateY(15px)",t.style.transition="none"
            }),
            requestAnimationFrame(()=>{
                e.forEach(t=>{
                    t.classList.contains("filtered-out")||(t.style.transition="transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1)",t.style.transform="",t.style.opacity="1")
                }),
                setTimeout(()=>{
                    e.forEach(t=>{
                        t.classList.contains("filtered-out")||(t.style.transition="",t.style.transform="",t.style.opacity="")
                    }),
                    k.style.minHeight="",
                    kArchive&&(kArchive.style.minHeight="")
                },600)
            })
        })
    }
    
    d&&R(d);
    let m=null;
    
    function $(i,e,a){
        !p||!n||(m=document.activeElement,p.src=i,p.alt=e||"Enlarged project image",v.textContent=a||"",v.style.display=a?"block":"none",n.classList.add("open"),n.setAttribute("aria-hidden","false"),n.focus())
    }
    
    function y(i,e){
        if(!n)return;
        m=document.activeElement,p&&(p.style.display="none"),v&&(v.textContent=e||"",v.style.display=e?"block":"none");
        let a=n.querySelector(".lightbox-iframe");
        a||(a=document.createElement("iframe"),a.className="lightbox-iframe",n.querySelector(".lightbox-container").insertBefore(a,v)),
        a.src=i+"?lightbox=true",
        a.style.display="block",
        n.classList.add("open"),
        n.setAttribute("aria-hidden","false"),
        n.focus()
    }
    
    function L(){
        n&&(n.classList.remove("open"),n.setAttribute("aria-hidden","true"),setTimeout(()=>{
            p&&(p.src="",p.style.display="block"),v&&(v.textContent="",v.style.display="none");
            const i=n.querySelector(".lightbox-iframe");
            i&&(i.src="",i.style.display="none"),m&&typeof m.focus=="function"&&m.focus()
        },400))
    }
    
    z&&z.addEventListener("click",L),
    n&&n.addEventListener("click",L);
    
    function x(i,e){
        i.addEventListener("click",a=>{
            const r=a.target.closest(".diagram-section");
            if(r){
                a.stopPropagation();
                const s=r.querySelector("iframe");
                if(s){
                    const l=r.nextElementSibling,u=l&&l.classList.contains("gallery-caption")?l.textContent:"";
                    y(s.getAttribute("src"),u)
                }
                return
            }
            if(a.target.tagName==="IMG"){
                a.stopPropagation();
                const s=a.target.closest(".gallery-item"),l=s?s.querySelector(".gallery-caption"):null;
                $(a.target.src,a.target.alt,l?l.textContent:"");
                return
            }
            const t=a.target.closest('a[href^="#"]');
            if(t){
                const s=t.getAttribute("href").substring(1),l=e&&e.querySelector(`#${s}`)||document.getElementById(s);
                l&&(a.preventDefault(),l.scrollIntoView({behavior:"smooth",block:"start"}))
            }
        })
    }
    
    d&&x(d,null),
    document.addEventListener("keydown",i=>{i.key==="Escape"&&n&&n.classList.contains("open")&&L()});
    
    function C(){
        const i=sessionStorage.getItem("live_reload_scroll_x"),
              e=sessionStorage.getItem("live_reload_scroll_y");
        i!==null&&e!==null?(sessionStorage.removeItem("live_reload_scroll_x"),sessionStorage.removeItem("live_reload_scroll_y"),window.scrollTo(parseInt(i,10),parseInt(e,10))):window.scrollTo(0,0)
    }
    
    async function M(i){
        const e=D.find(l=>l.id===i);
        if(!e){h(!1);return}
        const a=document.querySelector(".top-row"),
              r=document.querySelector(".filter-container"),
              t=document.getElementById("projects-grid"),
              tArchive=document.getElementById("archive-projects-grid"),
              tDivider=document.getElementById("archive-divider"),
              s=[a,r,t,tArchive,tDivider].filter(Boolean);
              
        s.forEach(l=>{l.style.transition="opacity 0.1s ease",l.style.opacity="0"});
        try{
            const l=await fetch(`/content/${i}/`);
            if(!l.ok)throw new Error("Content missing");
            let u=await l.text();
            u=u.replace(/(src|href)="(?:\.\/)?content\/[^\/]+\/audio\/([^\"]+\.mp3)"/g,'$1="https://media.ryanmarch.me/$2"');
            const c=document.createElement("div");
            c.innerHTML=u;
            const q=c.querySelectorAll("h4[id]");
            let H="";
            if(q.length>0){
                const f=Array.from(q).map(w=>`<a href="#${w.id}">${w.querySelector("span")?w.querySelector("span").innerHTML:w.innerHTML}</a>`);
                (e.actionUrl||e.sourceUrl)&&f.push('<a href="#project-detail-footer-actions">Links</a>'),
                H=`<nav class="project-nav"><div class="nav-links">${f.join("")}</div></nav>`
            }
            if(H){
                const f=c.querySelector(".project-description"),w=c.querySelector(".project-subtitle");
                f?f.insertAdjacentHTML("afterend",H):w&&w.insertAdjacentHTML("afterend",H),
                u=c.innerHTML
            }
            const I=`<div class="tag-list project-detail-tags">${o(e.tags)}</div>`;
            let A="";
            e.actionUrl||e.sourceUrl?(A+=`<hr class="project-detail-footer-divider">
 <div class="project-detail-footer-actions" id="project-detail-footer-actions">
 `,e.sourceUrl&&(A+=`    <a href="${e.sourceUrl}" class="project-btn project-detail-btn btn-secondary" target="_blank" rel="noopener noreferrer">
         <span>View More</span>
         <svg class="btn-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42L17.59 5H14V3zM19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2 2v-7h-2v7z"/></svg>
     </a>
 `),e.actionUrl&&(A+=`    <a href="${e.actionUrl}" class="project-btn project-detail-btn" target="_blank" rel="noopener noreferrer">
         <span>${e.actionText||"Visit"}</span>
         <svg class="btn-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42L17.59 5H14V3zM19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2 2v-7h-2v7z"/></svg>
     </a>
 `),A+=`    <a href="/" class="project-detail-back-btn data-spa-link">Back to Home</a>
 </div>`):A='<div class="project-detail-footer-actions"><a href="/" class="project-detail-back-btn data-spa-link">Back to Home</a></div>',
            d.innerHTML=I+u+A;
            const S=d.querySelector("img");
            S&&(S.removeAttribute("loading"),S.setAttribute("loading","eager"),S.setAttribute("fetchpriority","high")),
            R(d),
            i==="clear-tech"&&initClearTechBrochure(d),
            d.querySelectorAll(".data-spa-link").forEach(f=>f.addEventListener("click",w=>{w.preventDefault(),h()})),
            s.forEach(f=>{f.style.display="none",f.style.opacity="",f.style.transition=""}),
            document.body.classList.add("standalone-page"),
            d.style.opacity="0",
            d.style.display="block",
            C(),
            requestAnimationFrame(()=>{
                requestAnimationFrame(()=>{
                    d.style.transition="opacity 0.15s ease",
                    d.style.opacity="1",
                    setTimeout(()=>{d.style.transition=""},180)
                })
            }),
            document.title=`${e.title} | Ryan March`;
            let P=document.querySelector('link[rel="canonical"]');
            P&&P.setAttribute("href",`https://ryanmarch.me/project/${i}/`)
        }catch(l){
            console.error("Failed to load project",l),
            s.forEach(u=>{u.style.opacity="",u.style.transition=""})
        }
    }
    
    function h(i=!0){
        i&&window.location.pathname!=="/"?history.pushState(null,"","/"):!i&&window.location.pathname!=="/"&&history.replaceState(null,"","/"),
        document.title="Ryan March | Product & Technology";
        let e=document.querySelector('link[rel="canonical"]');
        e&&e.setAttribute("href","https://ryanmarch.me/");
        
        d.style.transition="opacity 0.1s ease",
        d.style.opacity="0",
        setTimeout(()=>{
            d.style.display="none",
            d.style.opacity="",
            d.style.transition="",
            d.innerHTML="",
            document.body.classList.remove("standalone-page");
            
            const a=document.querySelector(".top-row"),
                  r=document.querySelector(".filter-container");
                  
            const showActive = k && Array.from(k.querySelectorAll(".destination-card")).some(card => !card.classList.contains("filtered-out"));
            const showArchive = kArchive && Array.from(kArchive.querySelectorAll(".destination-card")).some(card => !card.classList.contains("filtered-out"));
            
            [a,r].forEach(s=>{s&&(s.style.opacity="0",s.style.display=s===a?"flex":"block")});
            if (k) { k.style.opacity="0"; k.style.display = showActive ? "grid" : "none"; }
            if (kArchive) { kArchive.style.opacity="0"; kArchive.style.display = showArchive ? "grid" : "none"; }
            if (archiveDivider) { archiveDivider.style.opacity="0"; archiveDivider.style.display = (showActive && showArchive) ? "flex" : "none"; }
            
            C(),
            requestAnimationFrame(()=>{
                requestAnimationFrame(()=>{
                    [a,r,k,kArchive,archiveDivider].forEach(s=>{
                        s&&(s.style.transition="opacity 0.15s ease",s.style.opacity="1")
                    }),
                    setTimeout(()=>{
                        [a,r,k,kArchive,archiveDivider].forEach(s=>{
                            s&&(s.style.transition="",s.style.opacity="")
                        })
                    },180)
                })
            })
        },120)
    }
    
    window.addEventListener("popstate",g);
    function g(){
        const e=window.location.pathname.match(/^\/project\/([^\/]+)\/?/);
        if(e){
            const a=e[1];
            M(a)
        }else h(!1)
    }
    
    d&&x(d,d),
    k&&k.addEventListener("click",i=>{
        const e=i.target.closest(".destination-card");
        if(!e||i.target.closest(".project-btn:not(.read-more-btn)"))return;
        const a=e.querySelector(".read-more-btn");
        if(a&&!i.target.closest("a:not(.read-more-btn)")){
            i.preventDefault();
            const r=a.getAttribute("href"),
                  t=a.getAttribute("data-project-id");
            history.pushState(null,"",r),
            M(t)
        }
    }),
    kArchive&&kArchive.addEventListener("click",i=>{
        const e=i.target.closest(".destination-card");
        if(!e||i.target.closest(".project-btn:not(.read-more-btn)"))return;
        const a=e.querySelector(".read-more-btn");
        if(a&&!i.target.closest("a:not(.read-more-btn)")){
            i.preventDefault();
            const r=a.getAttribute("href"),
                  t=a.getAttribute("data-project-id");
            history.pushState(null,"",r),
            M(t)
        }
    }),
    g();
    
    const b=document.querySelector(".slim-header-brand");
    b&&b.addEventListener("click",i=>{
        document.body.classList.contains("standalone-page")&&(i.preventDefault(),h())
    }),
    window.addEventListener("beforeunload",()=>{
        try{
            sessionStorage.setItem("live_reload_scroll_x",window.scrollX),
            sessionStorage.setItem("live_reload_scroll_y",window.scrollY)
        }catch{}
    })
});
