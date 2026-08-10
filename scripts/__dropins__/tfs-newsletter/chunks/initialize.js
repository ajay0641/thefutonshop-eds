/*! Copyright 2026 Adobe
All Rights Reserved. */
import{Initializer as o}from"@dropins/tools/lib.js";import{s as n,b as s}from"./fetch-graphql.js";const t=new o({init:async i=>{const e={...{storeViewCode:"default",websiteCode:"base"},...i};e.endpoint&&n(e.endpoint),s({"Magento-Store-View-Code":e.storeViewCode??"default","Magento-Website-Code":e.websiteCode??"base"}),t.config.setConfig(e)},listeners:()=>[]}),r=t.config;export{r as c,t as i};
//# sourceMappingURL=initialize.js.map
