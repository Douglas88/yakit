import React, {useEffect, useState} from "react";
import {Col, Collapse, Descriptions, PageHeader, Row, Space, Spin, Tabs, Tag, Typography} from "antd";
import {HTTPFlow} from "./HTTPFlowTable";
import {YakEditor} from "../utils/editors";
import {failed} from "../utils/notification";
import {FuzzableParamList} from "./FuzzableParamList";
import {FuzzerResponse} from "../pages/fuzzer/HTTPFuzzerPage";
import {randomString} from "../utils/randomUtil";

const {ipcRenderer} = window.require("electron");

export type SendToFuzzerFunc = (req: Uint8Array, isHttps: boolean) => any;

export interface HTTPFlowDetailProp {
    hash: string
    onSendToFuzzer?: SendToFuzzerFunc
}

const {Text} = Typography;

export interface FuzzerResponseToHTTPFlowDetail {
    response: FuzzerResponse
    onSendToFuzzer: SendToFuzzerFunc
}

export const FuzzerResponseToHTTPFlowDetail = (rsp: FuzzerResponseToHTTPFlowDetail) => {
    const [hash, setHash] = useState<string>();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>();

    useEffect(() => {
        const flag = randomString(30);
        ipcRenderer.on(flag, (e, data: HTTPFlow) => {
            setHash(data.Hash)
            setLoading(false)
        })
        ipcRenderer.on(`ERROR:${flag}`, (e, data: string) => {
            setLoading(false)
            failed("分析参数失败：" + data)
        })

        ipcRenderer.invoke("analyze-fuzzer-response", rsp.response, flag)

        return () => {
            ipcRenderer.removeAllListeners(flag)
            ipcRenderer.removeAllListeners(`ERROR:${flag}`)
        }
    }, [rsp.response])

    if (loading) {
        return <Spin tip={"正在分析详细参数"}/>
    }

    return <HTTPFlowDetail hash={hash || ""}/>
}

export const HTTPFlowDetail: React.FC<HTTPFlowDetailProp> = (props) => {
    const [flow, setFlow] = useState<HTTPFlow>();
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!props.hash) {
            return
        }

        ipcRenderer.on(props.hash, (e, data: HTTPFlow) => {
            setFlow(data)
            setTimeout(() => setLoading(false), 300)
        })
        ipcRenderer.on(`ERROR:${props.hash}`, (e, details) => {
            failed(`查询该请求失败[${props.hash}]: ` + details)
        })

        setLoading(true)
        ipcRenderer.invoke("get-http-flow", props.hash)

        return () => {
            ipcRenderer.removeAllListeners(props.hash)
            ipcRenderer.removeAllListeners(`ERROR:${props.hash}`)
        }
    }, [props.hash])

    return <Spin spinning={loading} style={{width: "100%", marginBottom: 24}}>
        {flow ? <>
            <PageHeader title={`请求详情`} subTitle={props.hash}/>
            <Space direction={"vertical"} style={{width: "100%"}}>
                <Descriptions column={4} bordered={true} size={"small"}>
                    <Descriptions.Item span={1} label={"HTTP 方法"}><Tag color={"geekblue"}><Text
                        style={{maxWidth: 500}}>{flow.Method}</Text></Tag></Descriptions.Item>
                    <Descriptions.Item span={3} label={"请求 URL"}>
                        <Text style={{maxWidth: 500}} copyable={true}>{flow.Url}</Text>
                    </Descriptions.Item>
                    <Descriptions.Item span={1} label={"HTTPS"}><Tag color={"geekblue"}>
                        <div
                            style={{maxWidth: 500}}>{flow.IsHTTPS ? "True" : "False"}</div>
                    </Tag></Descriptions.Item>
                    <Descriptions.Item span={1} label={"StatusCode"}><Tag
                        color={"geekblue"}>{flow.StatusCode}</Tag></Descriptions.Item>
                    <Descriptions.Item span={1} label={"Body大小"}><Tag color={"geekblue"}>
                        <div style={{maxWidth: 500}}>{flow.BodySizeVerbose}</div>
                    </Tag></Descriptions.Item>
                    <Descriptions.Item span={1} label={"Content-Type"}><Tag color={"geekblue"}>
                        <div style={{maxWidth: 500}}>{flow.ContentType}</div>
                    </Tag></Descriptions.Item>
                </Descriptions>
                <div style={{width: "100%", overflow: "auto"}}>
                    {flow.GetParams.length > 0 || flow.PostParams.length > 0 || flow.CookieParams.length > 0 ? <Tabs>
                        {flow.GetParams.length > 0 && <Tabs.TabPane key={"get"} tab={"GET 参数"}>
                            <FuzzableParamList data={flow.GetParams} onSendToFuzzer={props.onSendToFuzzer}/>
                        </Tabs.TabPane>}
                        {flow.PostParams.length > 0 && <Tabs.TabPane key={"post"} tab={"POST 参数"}>
                            <FuzzableParamList data={flow.PostParams} onSendToFuzzer={props.onSendToFuzzer}/>
                        </Tabs.TabPane>}
                        {flow.CookieParams.length > 0 && <Tabs.TabPane key={"cookie"} tab={"Cookie 参数"}>
                            <FuzzableParamList data={flow.CookieParams} onSendToFuzzer={props.onSendToFuzzer}/>
                        </Tabs.TabPane>}
                    </Tabs> : ""}
                </div>

                <Collapse>
                    <Collapse.Panel key={"request-raw"} header={"原始 HTTP 请求数据包内容"}>
                        <div style={{height: 280}}>
                            <YakEditor readOnly={true}
                                       value={new Buffer(flow.Request).toString("utf-8")}/>
                        </div>
                    </Collapse.Panel>
                    <Collapse.Panel key={"response-raw"} header={"原始 HTTP 响应数据包内容"}>
                        <div style={{height: 350}}>
                            <YakEditor readOnly={true}
                                       value={new Buffer(flow.Response).toString("utf-8")}
                            />
                        </div>
                    </Collapse.Panel>
                </Collapse>
                <Row gutter={8}>
                    <Col span={12}>
                        <Collapse defaultActiveKey={"request"}>
                            <Collapse.Panel key={"request"} header={"Request Headers"}>
                                <Descriptions bordered={true} column={1} size={"small"}>
                                    {(flow?.RequestHeader || []).sort((i, e) => {
                                        return i.Header.localeCompare(e.Header)
                                    }).map(i => {
                                        return <Descriptions.Item label={<Text style={{width: 240}}>
                                            <Tag>{i.Header}</Tag>
                                        </Text>}>
                                            <Text
                                                copyable={true}
                                                style={{maxWidth: 500}}
                                                ellipsis={{tooltip: true}}>{i.Value}</Text>
                                        </Descriptions.Item>
                                    })}
                                </Descriptions>
                            </Collapse.Panel>
                        </Collapse>
                    </Col>
                    <Col span={12}>
                        <Collapse defaultActiveKey={"response"}>
                            <Collapse.Panel key={"response"} header={"Response Headers"}>
                                <Descriptions bordered={true} column={1} size={"small"}>
                                    {(flow?.ResponseHeader || []).sort((i, e) => {
                                        return i.Header.localeCompare(e.Header)
                                    }).map(i => {
                                        return <Descriptions.Item label={<Text style={{width: 240}}>
                                            <Tag>{i.Header}</Tag>
                                        </Text>}>
                                            <Text
                                                copyable={true}
                                                style={{maxWidth: 500}}
                                                ellipsis={{tooltip: true}}>{i.Value}</Text>
                                        </Descriptions.Item>
                                    })}
                                </Descriptions>
                            </Collapse.Panel>
                        </Collapse>
                    </Col>
                </Row>
            </Space>
        </> : ""}
    </Spin>
};